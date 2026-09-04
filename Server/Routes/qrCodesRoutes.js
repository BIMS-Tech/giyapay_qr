import express from 'express';
import { createQrCode,handleSuccessCallback, handleCallback,getAdminQrCodes,exportAdminQrCodes,checkInvoice,getFilteredQrCodes,getQrCodesBU,getFilteredQrCodesCA,countQrCodesByAdmin,getPaymentDetailsByInvoice } from '../controller/qrCodesController.js';
import models from '../model/index.js';
import { authenticateToken } from '../middleware/authenticate.js';

const { QrCode } = models;

const router = express.Router();

// Routes for QR code management
router.get('/get', authenticateToken, getAdminQrCodes,);

// Full result set for CSV export (capped server-side)
router.get('/export', authenticateToken, exportAdminQrCodes);

// Routes for QR code management for Branch user
router.get('/get_qr_bu', authenticateToken, getQrCodesBU);


router.post('/create', createQrCode);

// Count
router.get('/count', authenticateToken, countQrCodesByAdmin);

// Callback
const validateCallbackType = (req, res, next) => {
  console.log('Validating callback type:', req.params.callbackType); 
  const { callbackType } = req.params;
  const validTypes = ['error-callback', 'cancel-callback']; // Removed 'success-callback'
  
  if (!validTypes.includes(callbackType)) {
      console.error('Invalid callback type:', callbackType);
      return res.status(400).json({ error: 'Invalid callback type' });
  }
  next();
};

router.post('/callback/:callbackType', validateCallbackType, (req, res, next) => {
  console.log('POST /callback/:callbackType route hit');
  next();
}, handleCallback);

// Route for handling success callback separately
router.post('/success-callback', handleSuccessCallback);


//check
router.get('/check-invoice/:invoice_number', checkInvoice);
//filter

router.get('/filter',authenticateToken, getFilteredQrCodes);

router.get('/coadmin_filter',authenticateToken, getFilteredQrCodesCA);

// Route for fetching payment details by invoice number
router.get('/api/payment-details/:invoice_number', getPaymentDetailsByInvoice);


router.get('/csv', async (req, res) => {
    try {
      const qrCodes = await QrCode.findAll(); 
  
      const fields = ['reference_no', 'branch_name', 'username', 'createdAt'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(qrCodes);
  
      const filePath = path.join(__dirname, 'qrcodes.csv');
      fs.writeFileSync(filePath, csv);
  
      res.download(filePath);
    } catch (error) {
      console.error('Error generating CSV:', error);
      res.status(500).send('Error generating CSV');
    }
  });

export default router;
