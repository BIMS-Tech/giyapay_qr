import { DataTypes } from 'sequelize';
import sequelize from '../database/connection.js';

const QrCode = sequelize.define('QrCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  qr_code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  payment_reference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
  },
  payment_channel: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nonce: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  signature: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  invoice_number: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  retry_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // When the background check may look at this row again. The check stamps it
  // on every row it touches, which is what keeps the queue rotating: a row
  // just checked sorts behind every row that is due, so no set of rows can
  // monopolise the batch and starve the rest. NULL means "never checked".
  //
  // Requires database/migrations/002_qr_codes_next_check_time.sql - the column
  // must exist before this model ships, or every query on qr_codes fails with
  // "Unknown column".
  next_check_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },

}, {
  tableName: 'qr_codes',
  timestamps: true,
  underscored: true,
});

export default QrCode;
