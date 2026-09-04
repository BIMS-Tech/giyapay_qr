import { Op } from 'sequelize';
import models from '../model/index.js';
const { QrCode, User, Branch ,Admin } = models;
import crypto from "crypto";
import { resolveTenantAdminId, branchScopeFor } from '../utils/scope.js';
import { invalidatePrefix } from '../utils/cache.js';

const createQrCode = async (req, res) => {
  try {
    const {
      branch_id,
      user_id,
      amount,
      qr_code,
      invoice_number,
      payment_channel,
      signature,
      nonce,
      description,
      admin_id,
      timestamp,
    } = req.body;

    // Validate that all fields are present
    if (
      !branch_id ||
      !user_id ||
      !amount ||
      !qr_code ||
      !invoice_number ||
      !payment_channel ||
      !signature ||
      !nonce ||
      !description ||
      !admin_id ||
      !timestamp
    ) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a valid positive number.' });
    }

    const branch = await Branch.findByPk(branch_id);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found. Please check the branch ID.' });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please check the user ID.' });
    }

    const existingInvoice = await QrCode.findOne({ where: { invoice_number } });
    if (existingInvoice) {
      return res.status(409).json({ error: 'Invoice number already exists. Please choose a different one.' });
    }

    // Create the QR code record
    const qrCode = await QrCode.create({
      branch_id,
      user_id,
      amount,
      qr_code,
      invoice_number,
      payment_channel,
      signature,
      nonce,
      description,
      admin_id,
      timestamp,
    });

    // Drop this tenant's cached dashboard so a new QR code shows up at once
    // rather than after the TTL expires.
    invalidatePrefix(`analytics:${admin_id}:`);

    // Success response with created QR code details
    res.status(201).json({
      message: 'QR code created successfully!',
      qrCode,
    });
  } catch (error) {
    console.error('Error creating QR code:', error);
    res.status(500).json({
      error: 'Internal server error. Please try again later.',
    });
  }
};

//Under fix
const handleCallback = async (req, res) => {
  try {
    console.log("Received callback request:", req.body);

    const { nonce, refno, amount, invoice_number, timestamp, id } = req.body; // 'id' is the admin ID
    const callbackType = req.params.callbackType;

    if (!nonce || !refno || !amount || !invoice_number || !timestamp || !id) {
      console.error("Invalid data provided:", req.body);
      return res.status(400).json({ message: "Invalid data provided" });
    }

    // Find QR Code
    const qrCode = await QrCode.findOne({ where: { invoice_number } });

    if (!qrCode) {
      console.error("QR Code not found for invoice number:", invoice_number);
      return res.status(404).json({ message: "QR Code not found" });
    }

    // Prevent duplicate processing
    if (["Failed", "Cancelled"].includes(qrCode.status)) {
      console.log("Transaction already processed:", qrCode.status);
      return res.status(200).json({ message: "Transaction already processed", qrCode });
    }

    // Update Status
    const updateData = {
      amount,
      payment_reference: refno,
    };

    switch (callbackType) {
      case "error-callback":
        updateData.status = "Failed";
        break;
      case "cancel-callback":
        updateData.status = "Cancelled";
        break;
      default:
        updateData.status = "Unknown";
        break;
    }

    await qrCode.update(updateData);
    invalidatePrefix(`analytics:${qrCode.admin_id}:`);

    console.log("QR Code updated successfully:", qrCode);

    const io = req.app.get("socketio");
    io.emit("qr-code-updated", { qrCode });

    res.status(200).json({ message: "QR Code updated successfully", qrCode });
  } catch (error) {
    console.error("Error handling callback:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default handleCallback;


const handleSuccessCallback = async (req, res) => {
  try {
    const { callbackUrl } = req.body;

    if (!callbackUrl) {
      return res.status(400).json({ message: "Callback URL is missing" });
    }

    // Extract parameters from callback URL
    const url = new URL(callbackUrl);
    const params = new URLSearchParams(url.search);

    const refno = params.get("refno");
    const amountInCents = params.get("amount");
    const invoice_number = params.get("invoice_number");
    const id = params.get("id"); // Admin ID from URL
    const callbackSignature = params.get("signature"); // Signature from Giyapay

    if (!refno || !amountInCents || !invoice_number || !id || !callbackSignature) {
      return res.status(400).json({ message: "Invalid callback parameters" });
    }

    // Fetch admin secret key from the database
    const admin = await Admin.findOne({ where: { id } });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const secretKey = admin.merchant_secret; // Use admin's secret key

    // Extracting the part of URL that needs to be hashed
    const toBeHashed = callbackUrl.split("&signature=");
    const myStringForHashing = `${toBeHashed[0]}${secretKey}`; // Remove `()` // Append secret key

    // Hashing with SHA512
    const computedSignature = crypto.createHash("sha512").update(myStringForHashing).digest("hex");

    console.log("Computed Signature:", computedSignature);
    console.log("Callback Signature:", callbackSignature);

    if (computedSignature !== callbackSignature) {
      return res.status(401).json({ message: "Signature verification failed" });
    }

    // Convert amount from cents to standard currency
    const amount = (parseFloat(amountInCents) / 100).toFixed(2);

    // Check if transaction exists
    const existingTransaction = await QrCode.findOne({ where: { invoice_number } });

    if (!existingTransaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (existingTransaction.status === "paid") {
      return res.status(200).json({ message: "Transaction already processed" });
    }

    // Update transaction status
    await QrCode.update(
      { status: "paid", amount, payment_reference: refno },
      { where: { id: existingTransaction.id } }
    );

    return res.status(200).json({
      message: "Transaction verified and updated successfully",
      amount,
      refno,
    });
  } catch (error) {
    console.error("Error verifying callback:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Only the columns the list actually renders. Keeps signature/nonce/timestamp
// and the joins' surplus columns off the wire.
const QR_LIST_ATTRIBUTES = [
  'id', 'qr_code', 'payment_reference', 'amount', 'status',
  'description', 'invoice_number', 'branch_id', 'createdAt', 'updatedAt',
];

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
// Sized above the current table (~20k rows) so a normal full export is not
// truncated, while still bounding a single request's memory.
const EXPORT_ROW_CAP = 25000;

// Shared where/include for every list + export path, so filtering happens in
// SQL instead of shipping the whole table to the browser.
const buildQrListQuery = (req, adminId, extraWhere = {}) => {
  const { searchTerm, branchFilter, userFilter, startDate, endDate, status } = req.query;

  const where = { admin_id: adminId, ...extraWhere };

  // Lets the dashboard's "needs attention" tiles deep-link into a filtered list.
  if (status) {
    where.status = status;
  }

  if (searchTerm) {
    where[Op.or] = [
      { payment_reference: { [Op.like]: `%${searchTerm}%` } },
      { invoice_number: { [Op.like]: `%${searchTerm}%` } },
    ];
  }

  if (startDate && endDate) {
    where.createdAt = { [Op.between]: [`${startDate} 00:00:00`, `${endDate} 23:59:59`] };
  } else if (startDate) {
    where.createdAt = { [Op.gte]: `${startDate} 00:00:00` };
  } else if (endDate) {
    where.createdAt = { [Op.lte]: `${endDate} 23:59:59` };
  }

  return {
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username'],
        // required only when the filter needs it -- otherwise LEFT JOIN, so a
        // QR code whose user was deleted still appears instead of vanishing.
        ...(userFilter ? { where: { username: userFilter }, required: true } : { required: false }),
      },
      {
        model: Branch,
        as: 'branch',
        attributes: ['branch_name'],
        ...(branchFilter ? { where: { branch_name: branchFilter }, required: true } : { required: false }),
      },
    ],
  };
};

// Shared responder for every role's list endpoint. extraWhere is passed
// explicitly, never as a third handler arg (Express would fill that with next).
const sendQrCodePage = async (req, res, extraWhere = {}) => {
  const adminId = resolveTenantAdminId(req.user);
  if (!adminId) {
    return res.status(400).json({ error: 'Admin ID is missing from the request' });
  }

  const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
  const requested = parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(requested, 1), MAX_PAGE_SIZE);

  const { count, rows } = await QrCode.findAndCountAll({
    ...buildQrListQuery(req, adminId, extraWhere),
    attributes: QR_LIST_ATTRIBUTES,
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: page * pageSize,
    distinct: true,
    subQuery: false,
  });

  return res.json({ rows, count, page, pageSize });
};

const getAdminQrCodes = async (req, res) => {
  try {
    return await sendQrCodePage(req, res);
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    return res.status(500).json({ error: 'Error fetching QR codes' });
  }
};

// CSV export needs every matching row, so it skips model instantiation
// (raw/nest) and is capped to keep one request from exhausting container memory.
const exportAdminQrCodes = async (req, res) => {
  try {
    const adminId = resolveTenantAdminId(req.user);
    if (!adminId) {
      return res.status(400).json({ error: 'Admin ID is missing from the request' });
    }

    const scope = await branchScopeFor(req.user);
    if (scope === null) {
      return res.status(403).json({ error: 'You are not assigned to any branch.' });
    }

    const rows = await QrCode.findAll({
      ...buildQrListQuery(req, adminId, scope),
      attributes: QR_LIST_ATTRIBUTES,
      order: [['createdAt', 'DESC']],
      limit: EXPORT_ROW_CAP,
      subQuery: false,
      raw: true,
      nest: true,
    });

    return res.json({ rows, count: rows.length, capped: rows.length === EXPORT_ROW_CAP });
  } catch (error) {
    console.error('Error exporting QR codes:', error);
    return res.status(500).json({ error: 'Error exporting QR codes' });
  }
};



// Branch users and Co-Admins share this endpoint. The branch-user page used to
// pull every QR code under the admin and filter by branch in the browser; that
// scope now lives in SQL.
const getQrCodesBU = async (req, res) => {
  try {
    const scope = await branchScopeFor(req.user);
    if (scope === null) {
      return res.status(403).json({ error: 'You are not assigned to any branch.' });
    }

    return await sendQrCodePage(req, res, scope);
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    return res.status(500).json({ error: 'Error fetching QR codes' });
  }
};


//Filtered qr for CA
// Co-Admins resolve to their parent admin, so this is the same paginated query.
const getFilteredQrCodesCA = async (req, res) => {
  try {
    return await sendQrCodePage(req, res);
  } catch (error) {
    console.error('Error fetching QR codes: ', error);
    return res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
};

//Filtered qr for admin
// /filter and /get now answer the same paginated, SQL-filtered query.
const getFilteredQrCodes = async (req, res) => {
  try {
    return await sendQrCodePage(req, res);
  } catch (error) {
    console.error('Error fetching QR codes: ', error);
    return res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
};


//check_invoice

const checkInvoice = async (req, res) => {
  try {
    const { invoice_number } = req.params;

    if (!invoice_number) {
      return res.status(400).json({ error: 'Invoice number is required' });
    }

    const qrCode = await QrCode.findOne({ where: { invoice_number } });

    if (!qrCode) {
      return res.status(404).json({ status: false });
    }

    res.json({ status: true });
  } catch (error) {
    console.error('Error checking invoice:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Controller to count QR codes based on admin ID
const countQrCodesByAdmin = async (req, res) => {
  try {
    const { userType, id, admin_id } = req.user; 

    let adminId;
    if (userType === 'admin') {
      adminId = id; 
    } else if (userType === 'Co-Admin' && admin_id) {
      adminId = admin_id; 
    } else {
      return res.status(400).json({ Status: false, message: 'Admin ID is required' });
    }

    console.log(`Counting QR codes for admin ID: ${adminId}`);

    const qrCodeCount = await QrCode.count({
      where: {
        admin_id: adminId, 
      },
    });

    res.json({ Status: true, Result: qrCodeCount });
  } catch (error) {
    console.error('Error counting QR codes:', error);
    res.status(500).json({ Status: false, error: 'Internal server error' });
  }
};

//Api for query the invoice and get pyment refrence and status

const getPaymentDetailsByInvoice = async (req, res) => {
  try {
    const { invoice_number } = req.params; 

    if (!invoice_number) {
      return res.status(400).json({ error: 'Invoice number is required' });
    }

    // Find the QR Code entry by invoice_number
    const qrCode = await QrCode.findOne({
      where: { invoice_number },
      attributes: ['payment_reference', 'status'],
    });

    if (!qrCode) {
      return res.status(404).json({ error: 'Invoice number not found' });
    }

    // Return the payment_reference and status
    res.status(200).json({
      reference_number: qrCode.payment_reference,
      payment_status: qrCode.status,
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};




export { 
  createQrCode, 
  handleCallback, 
  getAdminQrCodes,  
  exportAdminQrCodes,
  checkInvoice, 
  getFilteredQrCodes,
  getFilteredQrCodesCA, 
  getQrCodesBU  ,
  countQrCodesByAdmin,
  getPaymentDetailsByInvoice,
  handleSuccessCallback
};

