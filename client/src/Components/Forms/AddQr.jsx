import React, { useState, useEffect } from 'react';
import { Container, TextField, Button, Typography, Box, Divider, Grid, Modal } from '@mui/material';
import QRCode from 'react-qr-code';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import CryptoJS from 'crypto-js';
import { QRCodeCanvas } from 'qrcode.react';
import Customtextfield from '../../Components/Mui/CustomTextField'


const AddQr = () => {
  const [formData, setFormData] = useState({
    branch_name: '',
    invoice_number: '',
    amount: '',
    user_name: '',
  });
  const [generatedQrCode, setGeneratedQrCode] = useState('');
  const [showFields, setShowFields] = useState(true);
  const [userId, setUserId] = useState('');
  const [branchId, setBranchId] = useState('');

  const [adminId, setAdminId] = useState('');
  const [merchantID, setMerchantID] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [merchantSecret, setMerchantSecret] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [merchantUrl, setMerchantUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [gatewayAccount, setGatewayAccount] = useState('');
  const [merchantName, setMerchantName] = useState('');

  const [invoiceError, setInvoiceError] = useState('');
  const [amountError, setAmountError] = useState('');

  const navigate = useNavigate();

  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [showLink, setShowLink] = useState(false)



  useEffect(() => {
    const fetchUserAndBranchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const userResponse = await axios.get(`${backendUrl}/users/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const user = userResponse.data;

        if (user && user.branch) {
          setFormData((prevData) => ({
            ...prevData,
            branch_name: user.branch.branch_name,
            user_name: user.username,
          }));
          setUserId(user.id);
          setBranchId(user.branch_id);

          if (user.admin) {
            setAdminId(user.admin.id);
            setMerchantID(user.admin.merchant_id);
            setMerchantSecret(user.admin.merchant_secret);
            setCustomerEmail(user.admin.email);
            setPaymentUrl(user.admin.paymentUrl);
            setGatewayAccount(user.admin.gateway_account_type);
            setPaymentMethod(user.admin.payment_method);
            setMerchantName(user.admin.merchant_name);
            setMerchantUrl(user.admin.merchant_url);
          }

        } else {
          console.error('User does not have associated branch data');
        }
      } catch (error) {
        console.error('Error fetching user or branch data:', error);
      }
    };

    fetchUserAndBranchData();
  }, [backendUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // If the field is "amount", only allow numbers and one decimal point
    if (name === 'amount') {
      const regex = /^[0-9]*\.?[0-9]*$/;
      if (regex.test(value)) {
        setFormData({ ...formData, [name]: value });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setInvoiceError('');
    setAmountError('');

    // Validate invoice number
    if (!isValidInvoiceNumber(formData.invoice_number)) {
      setInvoiceError('Invalid IMS Sales Number. Please use only letters, numbers, and no special characters.');
      return;
    }

    // Check if invoice number already exists
    const invoiceExists = await checkInvoiceNumberExists(formData.invoice_number);
    if (invoiceExists) {
      setInvoiceError('IMS Sales Number number already exists. Please choose a different one.');
      return;
    }

    // Validate the amount field
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setAmountError('Please enter a valid amount greater than zero.');
      return;
    }
    // ----------------------
    try {
      const nonce = generateNonce();
      const timestamp = generateTimestamp();
      const amountInCents = (parseFloat(formData.amount) * 100).toFixed(0);

      const signature = generateSignature(
        amountInCents,
        formData.invoice_number,
        nonce,
        timestamp
      );

      const params = {
        success_callback: `${import.meta.env.VITE_FRONTEND_URL}/callback-page/success-callback?invoice_number=${formData.invoice_number}&merchant_url=${encodeURIComponent(merchantUrl)}&id=${adminId}`,
        error_callback: `${import.meta.env.VITE_FRONTEND_URL}/callback/error-callback?invoice_number=${formData.invoice_number}&merchant_url=${encodeURIComponent(merchantUrl)}&id=${adminId}`,
        cancel_callback: `${import.meta.env.VITE_FRONTEND_URL}/callback/cancel-callback?invoice_number=${formData.invoice_number}&merchant_url=${encodeURIComponent(merchantUrl)}&id=${adminId}`,        
        merchant_id: merchantID,
        amount: amountInCents,
        currency: 'PHP',
        nonce,
        timestamp,
        description: `Branch Name: ${formData.branch_name} || User Name: ${formData.user_name} || IMS Sales Number: ${formData.invoice_number}`,
        signature,
        order_id: formData.invoice_number,
        payWith: 'GiyaPay',
        gateway_account_type: gatewayAccount,
        payment_method: paymentMethod,
        merchant_name: merchantName,
      };

      const checkoutUrl = `${paymentUrl}/checkout/?${new URLSearchParams(params).toString()}`;

      // Save the QR code and initiate payment
      await axios.post(`${backendUrl}/api/qr-codes/create`, {
        branch_id: branchId,
        user_id: userId,
        amount: formData.amount,
        qr_code: checkoutUrl,
        invoice_number: formData.invoice_number,
        payment_channel: 'GiyaPay',
        signature,
        nonce,
        description: params.description,
        admin_id: adminId,
        timestamp,
      });

      setGeneratedQrCode(checkoutUrl);
      setShowFields(false);
    } catch (error) {
      console.error('Error creating QR code or redirecting:', error);
    }
  };

  const handleDone = () => {
    navigate('/branch-dashboard/manage-qrbu');
  };

  //generating signature for transaction
  const generateNonce = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

  const generateTimestamp = () => Math.floor(Date.now() / 1000);

  const generateSignature = (amount, invoice_number, nonce, timestamp) => {
    const secretKey = merchantSecret;
    const merchantId = merchantID;
    const currency = 'PHP';

    const myStringForHashing = `${merchantId}${amount}${currency}${invoice_number}${timestamp}${nonce}${secretKey}`;

    return CryptoJS.SHA512(myStringForHashing).toString(CryptoJS.enc.Hex);
  };


  const isValidInvoiceNumber = (invoice_number) => {
    const regex = /^[a-zA-Z0-9]+$/;
    return regex.test(invoice_number);
  };

  const checkInvoiceNumberExists = async (invoice_number) => {
    const encodedInvoiceNumber = encodeURIComponent(invoice_number);
    const url = `${backendUrl}/api/qr-codes/check-invoice/${encodedInvoiceNumber}`;

    try {
      const response = await axios.get(url);
      return response.data.status;
    } catch (error) {
      console.error('Error checking IMS Sales Number:', error.response ? error.response.data : error.message);
      return false;
    }
  };
  return (
    <Container maxWidth="sm">
      <Box textAlign="center" my={4}>
        {showFields ? (
          <>
            <Typography variant="h4" gutterBottom>Create QR Code</Typography>
            <Customtextfield
              label="Branch"
              name="branch_name"
              value={formData.branch_name}
              fullWidth
              margin="normal"
              disabled
            />
            <Customtextfield
              label="User"
              name="user_name"
              value={formData.user_name}
              fullWidth
              margin="normal"
              disabled
            />
            <Customtextfield
              label="IMS Sales Number #"
              name="invoice_number"
              value={formData.invoice_number}
              onChange={handleChange}
              fullWidth
              margin="normal"
              error={!!invoiceError}
              helperText={invoiceError}
            />
            <Customtextfield
              label="Amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              fullWidth
              margin="normal"
              error={!!amountError}
              helperText={amountError}
            />
            <Button
              variant="contained"
              onClick={handleSubmit}
              fullWidth
              sx={{
                color: '#fff',
                backgroundColor: '#FBB03A',
                '&:hover': {
                  backgroundColor: '#FBB03A',
                  boxShadow: 'none',
                },
                '&:focus': {
                  outline: 'none',
                },
                padding: '12px 24px',
                borderRadius: '8px',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 400,
                textTransform: 'none',
                transition: 'all 0.4s ease-in-out',
              }}
            >
              Generate QR Code
            </Button>



          </>
        ) : (
          <Box>
            {/* Title */}
            <Typography
              variant="h5"
              fontWeight="bold"
              gutterBottom
              sx={{ color: 'var(--app-text)', marginBottom: '24px', textAlign: 'center', fontFamily: 'Montserrat, sans-serif' }}
            >
              Transaction Details
            </Typography>

            {/* Divider for structure */}
            <Divider sx={{ marginBottom: '24px' }} />

            <Box sx={{ textAlign: 'center', marginBottom: '24px' }}>
              {/* Centered Amount */}
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#ed1f79', marginBottom: '16px' }}>
                ₱{new Intl.NumberFormat().format(formData.amount)}
              </Typography>

              {/* QR Code */}
              <QRCode
                value={generatedQrCode}
                size={300}
                style={{ width: '100%', height: 'auto', marginBottom: '10px' }}
              />
              {/* Centered Branch Name and Invoice Number */}
              <Typography variant="body1" sx={{ fontWeight: '500', color: 'var(--app-text)' }}>
                {formData.branch_name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                IMS Sales Number #: {formData.invoice_number}
              </Typography>
            </Box>

            {/* Proceed to Payment Button */}
            <Box mt={2}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                href={generatedQrCode}
                target="_blank"
                sx={{
                  padding: '12px 0',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  backgroundColor: '#ed1f79',
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: '#c2185b',
                  },
                }}
              >
                Proceed to Payment
              </Button>
            </Box>

            {/* Done Button */}
            <Box mt={3}>
              <Button
                variant="contained"
                onClick={handleDone}
                size="large"
                fullWidth
                sx={{
                  padding: '10px 0',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  backgroundColor: '#FBB03A',
                  '&:hover': {
                    backgroundColor: '#FBB03A',
                  },
                }}
              >
                Done
              </Button>
            </Box>
          </Box>


        )}
      </Box>
    </Container>
  );
};
export default AddQr;
