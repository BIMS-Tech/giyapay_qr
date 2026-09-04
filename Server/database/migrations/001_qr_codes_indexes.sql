-- Indexes for the QR code list/filter/cron queries.
--
-- qr_codes already carries single-column FK indexes (fk_qr_admin_id,
-- fk_qr_branch_id, fk_qr_user_id) and a unique nonce index, so those columns
-- are deliberately NOT repeated here. What was missing is a composite that
-- covers the sort: every list query is
--
--   WHERE admin_id = ? [AND branch_id = ?] ORDER BY created_at DESC LIMIT ?
--
-- An index on admin_id alone still forces a filesort over every row for that
-- tenant. Leading with the equality column and trailing with the sort column
-- lets InnoDB walk the index and stop at LIMIT.
--
-- Apply once:
--   mysql -h <host> -u <user> -p giyapayqr < 001_qr_codes_indexes.sql
-- Re-running errors with "Duplicate key name", which is harmless.

-- Admin and Co-Admin list: tenant + sort.
CREATE INDEX idx_qr_codes_admin_created
  ON qr_codes (admin_id, created_at);

-- Branch-user list: tenant + branch + sort, now that branch scoping is in SQL.
CREATE INDEX idx_qr_codes_admin_branch_created
  ON qr_codes (admin_id, branch_id, created_at);

-- checkTransactions.js scans for pending rows on an interval.
CREATE INDEX idx_qr_codes_status
  ON qr_codes (status);

-- Invoice lookups: /check-invoice/:invoice_number and the callback handlers.
CREATE INDEX idx_qr_codes_invoice_number
  ON qr_codes (invoice_number);

-- Exact payment_reference lookups from callbacks. The list's LIKE '%...%'
-- search cannot use this, but the callback path can.
CREATE INDEX idx_qr_codes_payment_reference
  ON qr_codes (payment_reference);
