import sequelize from './connection.js';

/**
 * Applies the schema the running code requires, once, at boot.
 *
 * qr_codes.next_check_time is not optional: qrCodesModel.js declares it, and
 * Sequelize names every declared attribute in its SELECT, so if the column is
 * missing then *every* query on qr_codes fails with "Unknown column" - the
 * whole QR list, the callbacks, the payment check. Leaving that to a manual
 * "run this SQL before you deploy" step makes a forgotten step an outage on a
 * live payment system, so the service closes the gap itself.
 *
 * Only schema the code cannot run without belongs here. One-off data cleanups
 * stay in database/migrations/ as SQL to be applied deliberately.
 *
 * Safe to run concurrently: Cloud Run starts many instances, each one checks
 * before it writes, and the duplicate-object errors that a race still produces
 * are treated as success.
 */

const DUPLICATE_ERRORS = new Set([
  'ER_DUP_FIELDNAME', // column already added by another instance
  'ER_DUP_KEYNAME',   // index already created by another instance
]);

const columnExists = async (table, column) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
      LIMIT 1`,
    { replacements: [table, column] }
  );
  return rows.length > 0;
};

const indexExists = async (table, indexName) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
      LIMIT 1`,
    { replacements: [table, indexName] }
  );
  return rows.length > 0;
};

const apply = async (label, sql) => {
  try {
    await sequelize.query(sql);
    console.log(`Schema: applied ${label}.`);
  } catch (error) {
    if (DUPLICATE_ERRORS.has(error?.parent?.code)) {
      console.log(`Schema: ${label} already present (applied concurrently).`);
      return;
    }
    throw error;
  }
};

export const ensureSchema = async () => {
  try {
    // The background payment check claims rows by this column and stamps a new
    // value on every row it touches, which is what stops one set of rows
    // monopolising the batch. A new column is NULL for every existing row,
    // which reads as "due now" - so adding it also re-queues the backlog of
    // pending QR codes the previous ordering had stopped checking.
    if (!(await columnExists('qr_codes', 'next_check_time'))) {
      await apply(
        'qr_codes.next_check_time',
        'ALTER TABLE qr_codes ADD COLUMN next_check_time DATETIME NULL'
      );
    }

    // Covers the claim query's equality column, then its range/sort column, so
    // InnoDB can walk the index and stop at LIMIT instead of filesorting every
    // pending row.
    if (!(await indexExists('qr_codes', 'idx_qr_codes_status_next_check'))) {
      await apply(
        'idx_qr_codes_status_next_check',
        'CREATE INDEX idx_qr_codes_status_next_check ON qr_codes (status, next_check_time)'
      );
    }

    return true;
  } catch (error) {
    // Do not crash the container: a database blip at boot should not take the
    // whole service down, and Cloud Run would just restart into the same
    // failure. Log it in terms that say exactly what to do.
    console.error(
      'SCHEMA NOT APPLIED - qr_codes.next_check_time is required by this build. ' +
        'Until it exists, every query on qr_codes will fail with "Unknown column". ' +
        'Apply Server/database/migrations/002_qr_codes_next_check_time.sql by hand. Cause:',
      error.message
    );
    return false;
  }
};

export default ensureSchema;
