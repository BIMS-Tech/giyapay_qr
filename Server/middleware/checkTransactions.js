import cron from "node-cron";
import axios from "axios";
import CryptoJS from "crypto-js";
import { Op } from "sequelize";
import models from "../model/index.js";

const { QrCode, Admin } = models;
const MAX_RETRIES = 30;
const RETRY_INTERVALS = [1, 2, 5, 10, 15, 30];

// This job used to load every pending transaction at once and fire a gateway
// request for all of them simultaneously via Promise.all. With ~20k QR codes
// that exhausted container memory every minute and killed in-flight user
// requests (500s with no response body). It is now bounded on three axes:
// how many rows a run claims, how many gateway calls are in flight, and
// whether a previous run is still going.
const BATCH_SIZE = 200;
const CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 10000;

// cron fires every minute regardless of how long the previous run took, so
// without this a slow run gets a second one stacked on top of it.
let runInProgress = false;

// checkTransactions emits socket events when given an io instance, but the
// scheduler had always called it with no argument, so those emits never fired.
let ioRef = null;
export const setTransactionIo = (io) => {
  ioRef = io;
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

// Function to check pending transactions
const checkTransactions = async (io) => {
  if (runInProgress) {
    console.log("Previous transaction check still running; skipping this tick.");
    return { skipped: true };
  }
  runInProgress = true;

  let checked = 0;
  let updated = 0;
  let failed = 0;

  try {
    const transactions = await QrCode.findAll({
      where: {
        status: "pending",
        // Rows past the retry cap are never going to resolve; leaving them out
        // stops the job re-checking them forever.
        [Op.or]: [{ retry_count: null }, { retry_count: { [Op.lt]: MAX_RETRIES } }],
      },
      include: [{ model: Admin, as: "admin", attributes: ["merchant_id", "merchant_secret", "paymentUrl"] }],
      // Least-tried first, and newest first among those: a QR created minutes
      // ago is far more likely to be mid-payment than one pending for months.
      order: [["retry_count", "ASC"], ["createdAt", "DESC"]],
      limit: BATCH_SIZE,
    });

    if (!transactions.length) {
      return { checked: 0, updated: 0, failed: 0 };
    }

    await mapWithConcurrency(transactions, CONCURRENCY, (async (transaction) => {
      checked += 1;
        try {
          if (!transaction.admin) {
            console.warn(`Admin data missing for transaction ${transaction.invoice_number}`);
            return;
          }

          const { invoice_number, retry_count } = transaction;
          const { merchant_id, merchant_secret, paymentUrl } = transaction.admin;

          if (!merchant_id || !merchant_secret || !paymentUrl) {
            console.warn(` Missing merchant details for transaction ${invoice_number}`);
            return;
          }

          const nonce = Math.random().toString(36).substring(2, 15);
          const timestamp = Math.floor(Date.now() / 1000);
          const signature = generateCheckTransactionSignature(merchant_id, invoice_number, timestamp, nonce, merchant_secret);

          const url = `${paymentUrl}/api/1.0/transaction/${invoice_number}?signature=${signature}&merchantId=${merchant_id}&timestamp=${timestamp}&nonce=${nonce}&secretKey=${merchant_secret}`;

          // Send GET request to check transaction status
          const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });

          if (response.data && response.data.data) {
            const { referenceNumber, status, amount } = response.data.data;

            await transaction.update({
              status: status.toLowerCase(),
              payment_reference: referenceNumber,
              amount: parseFloat(amount),
              retry_count: 0, // Reset retry count on success
            });

            updated += 1;

            // Emit real-time event to clients
            if (io) {
              io.emit("transactionUpdated", {
                invoice_number,
                status: status.toLowerCase(),
                referenceNumber,
                amount: parseFloat(amount),
              });
            }
          } else {
            console.warn(`⚠️ Unexpected response format for transaction ${invoice_number}`);
          }
        } catch (error) {
          if (error.response && error.response.status === 404) {
            const newRetryCount = (transaction.retry_count || 0) + 1;
            const retryInterval = RETRY_INTERVALS[Math.min(newRetryCount, RETRY_INTERVALS.length - 1)];

            // Mark transaction as expired if retry count exceeds MAX_RETRIES
            if (newRetryCount >= MAX_RETRIES) {
              await transaction.update({ status: "expired" });
              console.log(`Transaction ${invoice_number} marked as expired after ${newRetryCount} retries.`);

              // Emit real-time update to clients
              if (io) {
                io.emit("transactionExpired", { invoice_number });
              }
            } else {
              await transaction.update({
                retry_count: newRetryCount,
                next_check_time: new Date(Date.now() + retryInterval * 60 * 1000),
              });

              failed += 1;
            }
          } else {
            failed += 1;
            console.error(`Error processing transaction ${transaction.invoice_number}:`, error.message);
          }
        }
      }));

    console.log(`Transaction check: ${checked} checked, ${updated} updated, ${failed} failed.`);
    return { checked, updated, failed };
  } catch (error) {
    console.error("Error checking transactions:", error.message);
    return { checked, updated, failed, error: error.message };
  } finally {
    runInProgress = false;
  }
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
