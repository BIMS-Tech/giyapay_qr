-- Indexes for the QR code list/filter/count queries.
--
-- Every admin-facing query filters on admin_id and orders by created_at, but
-- qr_codes had no index on either -- so each request was a full table scan plus
-- a filesort. Apply once against the production database.
--
--   mysql -h <host> -u <user> -p <database> < 001_qr_codes_indexes.sql

-- Primary access path: WHERE admin_id = ? ORDER BY created_at DESC LIMIT ?
CREATE INDEX idx_qr_codes_admin_created ON qr_codes (admin_id, created_at);

-- Join targets for the user/branch includes.
CREATE INDEX idx_qr_codes_user_id   ON qr_codes (user_id);
CREATE INDEX idx_qr_codes_branch_id ON qr_codes (branch_id);

-- checkTransactions.js cron scans for pending rows on an interval.
CREATE INDEX idx_qr_codes_status ON qr_codes (status);

-- Invoice lookups: /check-invoice/:invoice_number and the callback handlers.
CREATE INDEX idx_qr_codes_invoice_number ON qr_codes (invoice_number);

-- Search filter uses payment_reference LIKE '%...%', which cannot use an index,
-- but exact-reference lookups from the callbacks can.
CREATE INDEX idx_qr_codes_payment_reference ON qr_codes (payment_reference);
