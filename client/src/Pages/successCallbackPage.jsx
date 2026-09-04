import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Container, Typography, Box, Button, Grid, Paper, LinearProgress, Alert } from '@mui/material';
import { CheckCircleOutline, ErrorOutline, Cancel } from '@mui/icons-material';
import axios from 'axios';

const SuccessCallback = () => {
  const location = useLocation();
  const [errorMessage, setErrorMessage] = useState('');
  const [transactionDetails, setTransactionDetails] = useState({ amount: '', refno: '' });
  const [transactionProcessed, setTransactionProcessed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [merchantUrl, setMerchantUrl] = useState('');

  useEffect(() => {
    const fullCallbackUrl = window.location.href;
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const merchant_url = params.get('merchant_url');
  
    if (merchant_url) setMerchantUrl(merchant_url);
  
    if (error) {
      setErrorMessage(error);
      setLoading(false);
    } else {
      setLoading(true);
      
      axios
        .post(`${import.meta.env.VITE_BACKEND_URL}/api/qr-codes/success-callback`, {
          callbackUrl: fullCallbackUrl,
        })
        .then((response) => {
          if (response.data.message === 'Transaction already processed') {
            setTransactionProcessed(true);
          } else {
            setTransactionDetails({
              amount: response.data.amount,
              refno: response.data.refno,
            });
          }
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error verifying transaction:', error.response?.data || error.message);
          setLoading(false);
        });
    }
  }, [location]); // Remove callbackType dependency
  

  return (
    <Container sx={{ maxWidth: 800, mt: 5, mb: 5 }}>
      <Box sx={{ textAlign: 'center' }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', mt: 5 }}>
            <Alert severity="info">
              Please wait, we are verifying your payment...
            </Alert>
            <LinearProgress sx={{ mt: 2, background: 'linear-gradient(#fbb03a, #ed1f79)' }} />
          </Box>
        ) : transactionProcessed ? (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleOutline sx={{ fontSize: 70, color: '#ed1f79' }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 2, color: '#ed1f79' }}>
              Transaction Already Processed
            </Typography>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleOutline sx={{ fontSize: 70, color: '#ed1f79' }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 2, color: '#ed1f79' }}>
              Payment Successful!
            </Typography>
            <Paper sx={{ p: 3, mt: 4, borderRadius: 3, backgroundColor: 'var(--app-surface)', boxShadow: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1">Amount</Typography>
                  <Typography variant="h6" sx={{ color: '#ed1f79' }}>
                    ₱{transactionDetails.amount}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1">Reference Number</Typography>
                  <Typography variant="h6">{transactionDetails.refno}</Typography>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        )}
        <Button
          variant="contained"
          sx={{
            mt: 4,
            backgroundColor: '#ed1f79',
            color: '#fff',
            fontWeight: 'bold',
            borderRadius: '25px',
            textTransform: 'none',
            fontSize: '16px',
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
            padding: '10px 20px',
            '&:hover': {
              backgroundColor: '#d91c6e',
            },
            '&:disabled': {
              backgroundColor: '#f8c4da',
              color: '#fff',
            },
          }}
          onClick={() => window.location.href = merchantUrl}
          disabled={!merchantUrl}
        >
          Return to Merchant
        </Button>
      </Box>
    </Container>
  );
};

export default SuccessCallback;
