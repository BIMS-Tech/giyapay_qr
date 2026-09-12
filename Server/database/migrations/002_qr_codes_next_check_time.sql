-- Fixes pending QR codes that were paid at GiyaPay but never updated here.
--
-- Section 1 is applied automatically at boot by database/ensureSchema.js, so
-- deploy order cannot break production. Sections 2 and 3 are one-off data
-- cleanups that are NOT automatic - run them by hand, in any order, before or
-- after the deploy.
--
-- Apply once:
--   mysql -h <host> -u <user> -p giyapayqr < 002_qr_codes_next_check_time.sql
-- Re-running errors with "Duplicate column name" / "Duplicate key name",
-- which is harmless.

-- ---------------------------------------------------------------------------
-- 1. The column the background check schedules itself with.
--
-- checkTransactions.js has always written next_check_time; the column never
-- existed, so Sequelize silently dropped it and the job fell back to ordering
-- by (retry_count ASC, created_at DESC). That ordering is static - nothing a
-- check did moved a row down the queue, and a "still PENDING" answer even
-- reset retry_count to 0 - so once there were more than 200 pending rows (the
-- batch size) every run re-read the same head of the queue and nothing behind
-- it was ever checked again.
-- ---------------------------------------------------------------------------
ALTER TABLE qr_codes ADD COLUMN next_check_time DATETIME NULL;

-- The job's claim query is
--   WHERE status = 'pending' AND (next_check_time IS NULL OR next_check_time <= NOW())
--   ORDER BY next_check_time ASC
-- so leading with the equality column and trailing with the range/sort column
-- lets InnoDB walk the index and stop at LIMIT.
CREATE INDEX idx_qr_codes_status_next_check
  ON qr_codes (status, next_check_time);

-- ---------------------------------------------------------------------------
-- 2. Normalise the status vocabulary.
--
-- The same outcome had up to three spellings depending on which code path
-- wrote it: the success callback wrote 'paid', the background check wrote the
-- gateway's own word lowercased ('success'), and the error/cancel callback
-- wrote capitalised 'Failed'/'Cancelled'. The status filter in the UI only
-- offers paid/pending/expired/cancelled/failed, so the other spellings were
-- unfilterable.
-- ---------------------------------------------------------------------------
UPDATE qr_codes SET status = 'paid'      WHERE status IN ('success', 'Success', 'SUCCESS', 'Paid', 'PAID', 'completed', 'COMPLETED');
UPDATE qr_codes SET status = 'failed'    WHERE status IN ('Failed', 'FAILED', 'error', 'Error', 'ERROR');
UPDATE qr_codes SET status = 'cancelled' WHERE status IN ('Cancelled', 'CANCELLED', 'canceled', 'Canceled', 'CANCELED');
UPDATE qr_codes SET status = 'pending'   WHERE status IN ('Pending', 'PENDING');
UPDATE qr_codes SET status = 'expired'   WHERE status IN ('Expired', 'EXPIRED');

-- ---------------------------------------------------------------------------
-- 3. Re-queue everything the starved job never got back to.
--
-- next_check_time IS NULL means "due now", so the fixed job picks these up at
-- BATCH_SIZE per minute and asks the gateway about each one. Anything that was
-- really paid flips to 'paid' on its own.
-- ---------------------------------------------------------------------------
UPDATE qr_codes SET next_check_time = NULL WHERE status = 'pending';

-- Rows the old job expired purely because it burned 30 retries in 30 minutes
-- (RETRY_INTERVALS was computed into next_check_time, which did not exist, so
-- there was no backoff at all). Anything expired inside the last 30 days is
-- worth one honest re-check; a genuinely dead QR just expires again.
UPDATE qr_codes
   SET status = 'pending', retry_count = 0, next_check_time = NULL
 WHERE status = 'expired'
   AND payment_reference IS NULL
   AND created_at >= NOW() - INTERVAL 30 DAY;
