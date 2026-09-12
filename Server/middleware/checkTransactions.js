import cron from "node-cron";
import axios from "axios";
import CryptoJS from "crypto-js";
import { Op } from "sequelize";
import models from "../model/index.js";
import { invalidatePrefix } from "../utils/cache.js";

const { QrCode, Admin } = models;

// Bounded so one run cannot exhaust container memory or the gateway's rate
// limit: how many rows a run claims, how many calls are in flight, and whether
// a previous run is still going.
const BATCH_SIZE = 200;
const CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 10000;

// A 404 means the gateway has never heard of the invoice, which is the normal
// state of a QR nobody has scanned yet. So a row is only written off once it
// has 404'd this many times *and* is old enough that nobody is realistically
// going to pay it - expiring on the retry count alone used to kill QR codes
// that were barely an hour old.
const MAX_RETRIES = 30;
const MIN_AGE_BEFORE_EXPIRY_MS = 24 * 60 * 60 * 1000;

const MINUTE_MS = 60 * 1000;

// When a pending QR may be looked at again, by how old it is. One created
// minutes ago is probably being paid right now; one from last week almost
// certainly never will be, and polling it every minute only burns gateway
// calls.
//
// This is also what keeps the queue fair, which is the actual bug being fixed
// here. Every row the job touches gets a next_check_time stamped on it, so it
// sorts behind everything still due and cannot be picked again until its turn
// comes round.
//
// The previous ordering (retry_count ASC, createdAt DESC) was static: nothing
// a check did moved a row down the queue. A "still PENDING" answer even reset
// retry_count to 0, putting the row straight back at the head. So once there
// were more than BATCH_SIZE pending rows, every run re-read the same head of
// the queue and nothing behind it was ever looked at again. A QR that fell out
// of that window - which any row does within a day at this volume - kept the
// status it had at its last check forever, so one paid minutes after it was
// generated stayed "pending" with its updated_at frozen at the single check it
// did get.
const CHECK_SCHEDULE = [
  { maxAgeMs: 15 * MINUTE_MS, intervalMs: MINUTE_MS },
  { maxAgeMs: 2 * 60 * MINUTE_MS, intervalMs: 5 * MINUTE_MS },
  { maxAgeMs: 24 * 60 * MINUTE_MS, intervalMs: 30 * MINUTE_MS },
  { maxAgeMs: 7 * 24 * 60 * MINUTE_MS, intervalMs: 4 * 60 * MINUTE_MS },
];
const FALLBACK_INTERVAL_MS = 24 * 60 * MINUTE_MS;

// cron fires every minute regardless of how long the previous run took, so
// without this a slow run gets a second one stacked on top of it.
let runInProgress = false;

// checkTransactions emits socket events when given an io instance, but the
// scheduler had always called it with no argument, so those emits never fired.
let ioRef = null;
export const setTransactionIo = (io) => {
  ioRef = io;
};

// The gateway spells outcomes its own way (SUCCESS/PENDING/FAILED/...), the
// success callback writes 'paid' and the error callback wrote capitalised
// 'Failed'. Everything that reads status - the dashboard tiles, the list's
// status filter - expects one lowercase vocabulary, so every writer maps into
// it here rather than storing whatever word it happened to receive.
export const CANONICAL_STATUSES = ["paid", "pending", "failed", "cancelled", "expired"];

const STATUS_ALIASES = {
  success: "paid",
  successful: "paid",
  paid: "paid",
  completed: "paid",
  complete: "paid",
  settled: "paid",
  pending: "pending",
  processing: "pending",
  unpaid: "pending",
  failed: "failed",
  failure: "failed",
  error: "failed",
  declined: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
  voided: "cancelled",
  void: "cancelled",
  expired: "expired",
};

export const normalizeStatus = (raw) => {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return STATUS_ALIASES[key] || key;
};

const nextCheckTimeFor = (createdAt) => {
  const age = Date.now() - new Date(createdAt).getTime();
  const step = CHECK_SCHEDULE.find((s) => age < s.maxAgeMs);
  return new Date(Date.now() + (step ? step.intervalMs : FALLBACK_INTERVAL_MS));
};

// Runs `worker` over `items` with at most `limit` in flight at once.
const mapWithConcurrency = async (items, limit, worker) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
};

// Generate transaction check signature
const generateCheckTransactionSignature = (merchantID, invoice_number, timestamp, nonce, merchantSecret) => {
  const myStringForHashing = `${merchantID}${invoice_number}${timestamp}${nonce}${merchantSecret}`;
  return CryptoJS.SHA512(myStringForHashing).toString(CryptoJS.enc.Hex);
};

// The list pages merge this into the row they already hold, so only the fields
// the check can change need to travel. The event name matters: the job used to
// emit "transactionUpdated", which nothing in the client listens for, so even
// the updates it did make never reached an open screen.
const emitUpdate = (io, transaction) => {
  if (!io) return;
  io.emit("qr-code-updated", {
    qrCode: {
      id: transaction.id,
      invoice_number: transaction.invoice_number,
      status: transaction.status,
      payment_reference: transaction.payment_reference,
      amount: transaction.amount,
      updatedAt: transaction.updatedAt,
    },
  });
};

// The gateway's field names vary between its endpoints, and picking the wrong
// one leaves payment_reference null forever with no error to notice.
const readReference = (payload) =>
  payload.referenceNumber ?? payload.reference_number ?? payload.refno ?? payload.reference ?? null;

/**
 * Ask the gateway about one pending QR code and write back what it says.
 *
 * Always stamps next_check_time, on every path including the ones that give
 * up early - a row left with next_check_time NULL stays permanently due and
 * sits at the head of the queue, which is the starvation this replaces.
 *
 * Returns one of: 'updated' | 'unchanged' | 'expired' | 'retry' | 'skipped' | 'failed'.
 */
const syncTransaction = async (transaction, io) => {
  const { invoice_number } = transaction;

  // Bookkeeping-only writes go in silently. next_check_time and retry_count
  // are internal, and letting them bump updated_at would put a fresh
  // timestamp on every pending row on every sweep - the "Updated At" column
  // on the QR list is meant to say when the payment last actually changed.
  const reschedule = () =>
    transaction.update({ next_check_time: nextCheckTimeFor(transaction.createdAt) }, { silent: true });

  if (!transaction.admin) {
    console.warn(`Admin data missing for transaction ${invoice_number}`);
    await reschedule();
    return "skipped";
  }

  const { merchant_id, merchant_secret, paymentUrl } = transaction.admin;
  if (!merchant_id || !merchant_secret || !paymentUrl) {
    console.warn(`Missing merchant details for transaction ${invoice_number}`);
    await reschedule();
    return "skipped";
  }

  try {
    const nonce = Math.random().toString(36).substring(2, 15);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateCheckTransactionSignature(merchant_id, invoice_number, timestamp, nonce, merchant_secret);

    const url = `${paymentUrl}/api/1.0/transaction/${invoice_number}?signature=${signature}&merchantId=${merchant_id}&timestamp=${timestamp}&nonce=${nonce}&secretKey=${merchant_secret}`;

    const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });

    const payload = response.data?.data ?? response.data;
    const status = normalizeStatus(payload?.status);

    if (!payload || !status) {
      // Not an error the retry ladder should count - the gateway answered, we
      // just could not read it. Log loudly and come back later.
      console.warn(`Unexpected response format for transaction ${invoice_number}`);
      await reschedule();
      return "skipped";
    }

    const update = {
      status,
      // The gateway knows this invoice, so the "never heard of it" counter
      // starts over.
      retry_count: 0,
      next_check_time: nextCheckTimeFor(transaction.createdAt),
    };

    const reference = readReference(payload);
    if (reference) {
      update.payment_reference = String(reference);
    }

    // The amount is deliberately not copied back. It is fixed when the QR is
    // generated and signed into the checkout URL, and the gateway reports it
    // in minor units (the checkout is built from amountInCents), so assigning
    // it here rewrote every polled row's amount as 100x what was charged.
    const gatewayAmount = parseFloat(payload.amount);
    if (Number.isFinite(gatewayAmount)) {
      const local = parseFloat(transaction.amount);
      const matches = Math.abs(gatewayAmount - local) < 0.01 || Math.abs(gatewayAmount - local * 100) < 1;
      if (!matches) {
        console.warn(
          `Amount mismatch for transaction ${invoice_number}: local ${local}, gateway ${gatewayAmount}`
        );
      }
    }

    const statusChanged = transaction.status !== status;
    const referenceChanged =
      update.payment_reference !== undefined && update.payment_reference !== transaction.payment_reference;

    // Still pending and nothing new to show: this was a poll, not an event.
    await transaction.update(update, { silent: !statusChanged && !referenceChanged });

    if (statusChanged) {
      emitUpdate(io, transaction);
      invalidatePrefix(`analytics:${transaction.admin_id}:`);
      console.log(`Transaction ${invoice_number} -> ${status}`);
      return "updated";
    }

    return "unchanged";
  } catch (error) {
    if (error.response && error.response.status === 404) {
      const newRetryCount = (transaction.retry_count || 0) + 1;
      const ageMs = Date.now() - new Date(transaction.createdAt).getTime();

      if (newRetryCount >= MAX_RETRIES && ageMs >= MIN_AGE_BEFORE_EXPIRY_MS) {
        await transaction.update({
          status: "expired",
          retry_count: newRetryCount,
          next_check_time: null,
        });
        emitUpdate(io, transaction);
        invalidatePrefix(`analytics:${transaction.admin_id}:`);
        console.log(`Transaction ${invoice_number} marked as expired after ${newRetryCount} retries.`);
        return "expired";
      }

      await transaction.update(
        { retry_count: newRetryCount, next_check_time: nextCheckTimeFor(transaction.createdAt) },
        { silent: true }
      );
      return "retry";
    }

    // Timeout, connection reset, 5xx: the gateway's problem, not the row's.
    // Do not touch retry_count, but still push the row back in the queue so a
    // gateway outage cannot wedge the whole batch on the same rows.
    console.error(`Error processing transaction ${invoice_number}:`, error.message);
    try {
      await reschedule();
    } catch (writeError) {
      console.error(`Could not reschedule transaction ${invoice_number}:`, writeError.message);
    }
    return "failed";
  }
};

// Function to check pending transactions
const checkTransactions = async (io) => {
  if (runInProgress) {
    console.log("Previous transaction check still running; skipping this tick.");
    return { skipped: true };
  }
  runInProgress = true;

  const tally = { checked: 0, updated: 0, unchanged: 0, expired: 0, retry: 0, skipped: 0, failed: 0 };

  try {
    const transactions = await QrCode.findAll({
      where: {
        status: "pending",
        // Due now, or never checked. There is no retry_count ceiling here any
        // more: a row past MAX_RETRIES is expired explicitly by
        // syncTransaction, and the old ceiling silently dropped rows out of
        // the job while leaving them at "pending" forever.
        [Op.or]: [{ next_check_time: null }, { next_check_time: { [Op.lte]: new Date() } }],
      },
      include: [{ model: Admin, as: "admin", attributes: ["merchant_id", "merchant_secret", "paymentUrl"] }],
      // Longest-waiting first (MySQL sorts NULL first, so never-checked rows
      // lead), newest first among rows due at the same moment.
      order: [
        ["next_check_time", "ASC"],
        ["createdAt", "DESC"],
      ],
      limit: BATCH_SIZE,
    });

    if (!transactions.length) {
      return tally;
    }

    await mapWithConcurrency(transactions, CONCURRENCY, async (transaction) => {
      tally.checked += 1;
      try {
        const outcome = await syncTransaction(transaction, io);
        tally[outcome] = (tally[outcome] || 0) + 1;
      } catch (error) {
        // syncTransaction handles its own gateway errors; anything reaching
        // here is a database failure. Swallow it so one bad row cannot reject
        // Promise.all and abandon the rest of the batch.
        tally.failed += 1;
        console.error(`Unhandled error for transaction ${transaction.invoice_number}:`, error.message);
      }
    });

    console.log(
      `Transaction check: ${tally.checked} checked, ${tally.updated} updated, ` +
        `${tally.expired} expired, ${tally.retry} awaiting gateway, ${tally.failed} failed.`
    );
    return tally;
  } catch (error) {
    console.error("Error checking transactions:", error.message);
    return { ...tally, error: error.message };
  } finally {
    runInProgress = false;
  }
};

/**
 * Check one invoice on demand, ignoring its place in the queue.
 *
 * The scheduled job is fair but not instant - a tenant with a large pending
 * backlog can be an hour from its next turn - and a cashier looking at a
 * customer's paid receipt needs an answer now.
 */
export const refreshTransactionByInvoice = async (invoice_number, io, extraWhere = {}) => {
  const transaction = await QrCode.findOne({
    where: { invoice_number, ...extraWhere },
    include: [{ model: Admin, as: "admin", attributes: ["merchant_id", "merchant_secret", "paymentUrl"] }],
  });

  if (!transaction) {
    return { found: false };
  }

  // Terminal states are not re-read: the gateway is not going to change its
  // mind, and a refund is not something this job models.
  if (transaction.status !== "pending") {
    return { found: true, outcome: "unchanged", transaction };
  }

  const outcome = await syncTransaction(transaction, io);
  return { found: true, outcome, transaction };
};

// The in-process cron is off by default, and Cloud Scheduler drives
// POST /internal/check-transactions instead. Two reasons:
//
//  1. Cloud Run scales to zero. With no traffic there is no container, so the
//     job simply stopped running - the logs showed 20-minute gaps.
//  2. node-cron runs inside *every* instance. Under load with maxScale 100
//     that multiplied the gateway calls by the instance count.
//
// Set ENABLE_INPROCESS_CRON=true only for local development, where there is
// no scheduler.
if (process.env.ENABLE_INPROCESS_CRON === "true") {
  console.log("In-process transaction cron enabled (development mode).");
  cron.schedule("*/1 * * * *", async () => {
    await checkTransactions(ioRef);
  });
}

export default checkTransactions;
