import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Button, Container, Modal, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, Typography, IconButton, Tooltip, CircularProgress, Alert
} from '@mui/material';
import { Visibility as ViewIcon, } from '@mui/icons-material';
import axios from 'axios';
import QRCode from 'qrcode.react';
import { io } from 'socket.io-client';
import RippleLoader from '../Components/Loader';

const ManageQrBU = () => {
  const [qrCodes, setQrCodes] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [selectedQr, setSelectedQr] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [openView, setOpenView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const socketRef = useRef(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const authHeader = useCallback(
    () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
    []
  );

  const queryParams = useMemo(
    () => ({ page, pageSize: rowsPerPage }),
    [page, rowsPerPage]
  );

  const formatRow = (qr) => ({
    ...qr,
    user_name: qr.user ? qr.user.username : 'Unknown User',
    branch_name: qr.branch ? qr.branch.branch_name : 'Unknown Branch',
    created_at: qr.createdAt ? new Date(qr.createdAt).toLocaleString() : 'N/A',
    updated_at: qr.updatedAt ? new Date(qr.updatedAt).toLocaleString() : 'N/A',
  });

  // Socket lives in a ref: holding it in state made the fetch effect re-run on
  // every (re)connect, loading the list twice per mount.
  useEffect(() => {
    // Cloud Run has no session affinity, so Socket.IO's polling handshake can
    // land on an instance that never saw the session and 400s.
    const socket = io(backendUrl, {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    const applyUpdate = (data) => {
      const updated = formatRow(data.qrCode);
      setQrCodes((prev) =>
        prev.map((qr) => (qr.id === updated.id ? { ...qr, ...updated } : qr))
      );
    };

    const applyDelete = (deletedQrCodeId) => {
      setQrCodes((prev) => prev.filter((qr) => qr.id !== deletedQrCodeId));
    };

    socket.on('qr-code-updated', applyUpdate);
    socket.on('qr-code-deleted', applyDelete);

    return () => {
      socket.off('qr-code-updated', applyUpdate);
      socket.off('qr-code-deleted', applyDelete);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [backendUrl]);

  // The server scopes to this user's branch and paginates, so the page no
  // longer fetches the profile or filters the whole table in the browser.
  useEffect(() => {
    let cancelled = false;

    const fetchQrCodes = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axios.get(`${backendUrl}/api/qr-codes/get_qr_bu`, {
          params: queryParams,
          ...authHeader(),
        });
        if (cancelled) return;
        setQrCodes((data.rows || []).map(formatRow));
        setRowCount(data.count || 0);
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching QR codes:', err);
        setQrCodes([]);
        setRowCount(0);
        if (err.response?.status === 401) {
          setError('Your session has expired. Please sign in again.');
        } else if (err.response?.status === 403) {
          setError('You are not assigned to any branch. Please contact support.');
        } else {
          setError('Could not load QR codes. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchQrCodes();
    return () => {
      cancelled = true;
    };
  }, [backendUrl, queryParams, authHeader]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenView = (qr) => {
    setSelectedQr(qr);
    setOpenView(true);
  };

  const handleCloseView = () => {
    setOpenView(false);
    setSelectedQr(null);
  };

  if (loading && qrCodes.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="80vh"
      >
        <RippleLoader />
      </Box>
    );
  }

  return (
    <Container maxWidth={false} disableGutters>
      <Box mt={4} width="100%">
        <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
          Manage QR Codes
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2, fontFamily: 'Montserrat, sans-serif' }}>
            {error}
          </Alert>
        )}

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>ID</TableCell>
                <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>QR Code</TableCell>
                <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Payment Reference</TableCell>
                <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Amount</TableCell>
                <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Status</TableCell>
                <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Description</TableCell>
                <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Created At</TableCell>
                <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Updated At</TableCell>
                <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {qrCodes.map((qr, index) => (
                <TableRow key={qr.id || `qr-${index}`}>
                  <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{qr.id}</TableCell>
                  <TableCell>
                    <QRCode value={qr.qr_code} size={50} />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{qr.payment_reference}</TableCell>
                  <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{qr.amount}</TableCell>
                  <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{qr.status}</TableCell>
                  <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }} style={{ whiteSpace: 'pre-wrap' }}>
                    {qr.description}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{qr.created_at}</TableCell>
                  <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{qr.updated_at}</TableCell>
                  <TableCell>
                    <Tooltip title="View QR Code">
                      <IconButton onClick={() => handleOpenView(qr)}>
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={rowCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Box>
      <Modal open={openView} onClose={handleCloseView}>
        <Box
          p={4}
          bgcolor="background.paper"
          borderRadius={2}
          width="90%"
          maxWidth="600px"
          mx="auto"
          mt={4}
          style={{ outline: 'none' }}
        >
          {selectedQr && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
                QR Code Details
              </Typography>
              <Box mb={3} display="flex" justifyContent="center">
                <QRCode value={selectedQr.qr_code} size={200} />
              </Box>
              <Box mb={2}>
                <Typography variant="body1" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
                  <strong>ID:</strong> {selectedQr.id}
                </Typography>
                <Typography variant="body1" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
                  <strong>Payment Reference:</strong> {selectedQr.payment_reference}
                </Typography>
                <Typography variant="body1" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
                  <strong>Amount:</strong> {selectedQr.amount}
                </Typography>
                <Typography variant="body1" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
                  <strong>Status:</strong> {selectedQr.status}
                </Typography>
                <Typography
                  sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}
                  variant="body1"
                  gutterBottom
                  style={{
                    whiteSpace: 'pre-wrap',
                    backgroundColor: 'var(--app-surface-muted)',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                  }}
                >
                  <strong>Description:</strong> {selectedQr.description}
                </Typography>
                <Typography variant="body1" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
                  <strong>Created At:</strong> {selectedQr.created_at}
                </Typography>
                <Typography variant="body1" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
                  <strong>Updated At:</strong> {selectedQr.updated_at}
                </Typography>
                <Box mt={2} display="flex" justifyContent="flex-end">
                  <Button variant="contained" color="primary" onClick={handleCloseView} sx={{
                    maxWidth: '150px',
                    flex: 1,
                    backgroundColor: '#FBB03A',
                    color: 'black',
                    '&:hover': {
                      backgroundColor: '#ED1F79',
                    },
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 400,
                  }}
                  >
                    Close
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Modal>
    </Container>
  );
};
export default ManageQrBU;
