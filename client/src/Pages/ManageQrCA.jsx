import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Button, Container, Modal, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, Typography, IconButton, Tooltip, TextField, MenuItem, Select, InputLabel, FormControl, CircularProgress, Autocomplete, Alert
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { io } from 'socket.io-client';
import RippleLoader from '../Components/Loader';
import CustomTextField from '../Components/Mui/CustomTextField';

const ManageQrCA = () => {
  const [qrCodes, setQrCodes] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedQr, setSelectedQr] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [openView, setOpenView] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const socketRef = useRef(null);

  const [searchParams] = useSearchParams();

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // The dashboard's "needs attention" tiles link here as ?status=pending etc.
  useEffect(() => {
    const fromUrl = searchParams.get('status') || '';
    setStatusFilter(fromUrl);
    setPage(0);
  }, [searchParams]);

  const authHeader = useCallback(
    () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
    []
  );

  // Search used to fire a full query per keystroke; wait for a pause instead.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const queryParams = useMemo(
    () => ({
      page,
      pageSize: rowsPerPage,
      searchTerm: debouncedSearch || undefined,
      status: statusFilter || undefined,
      branchFilter: branchFilter || undefined,
      userFilter: userFilter || undefined,
      startDate: dateFilter.startDate || undefined,
      endDate: dateFilter.endDate || undefined,
    }),
    [page, rowsPerPage, debouncedSearch, branchFilter, userFilter, dateFilter, statusFilter]
  );

  const formatRow = (qr) => ({
    ...qr,
    user_name: qr.user ? qr.user.username : 'Unknown User',
    branch_name: qr.branch ? qr.branch.branch_name : 'Unknown Branch',
    created_at: qr.createdAt ? new Date(qr.createdAt).toLocaleString() : 'N/A',
    updated_at: qr.updatedAt ? new Date(qr.updatedAt).toLocaleString() : 'N/A',
  });

  // Socket lives in a ref: keeping it in state made the fetch effect re-run on
  // every (re)connect, so the list was loaded twice on each mount.
  useEffect(() => {
    // Cloud Run has no session affinity by default, so Socket.IO's polling
    // handshake lands on a different instance than its session and 400s.
    // Going straight to websocket skips the polling upgrade entirely.
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

  // One request per view. The server paginates and filters, so the browser
  // holds one page of rows instead of the whole table.
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
        setError(
          err.response?.status === 401
            ? 'Your session has expired. Please sign in again.'
            : 'Could not load QR codes. Please try again.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchQrCodes();
    return () => {
      cancelled = true;
    };
  }, [backendUrl, queryParams, authHeader]);

  useEffect(() => {
    const fetchBranchesAndUsers = async () => {
      try {
        const [branchesResponse, usersResponse] = await Promise.all([
          axios.get(`${backendUrl}/branches/coadmin_all`, authHeader()),
          axios.get(`${backendUrl}/users/coadmin_all`, authHeader()),
        ]);

        setBranches(branchesResponse.data);
        setUsers(usersResponse.data);
      } catch (error) {
        console.error('Error fetching branches and users:', error);
      }
    };

    fetchBranchesAndUsers();
  }, [backendUrl, authHeader]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Export pulls the full filtered set on demand instead of the page keeping
  // every row in memory just in case someone clicks download.
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await axios.get(`${backendUrl}/api/qr-codes/export`, {
        params: { ...queryParams, page: undefined, pageSize: undefined },
        ...authHeader(),
      });

      const rows = (data.rows || []).map(formatRow);
      if (data.capped) {
        setError(
          `Export limited to the most recent ${rows.length.toLocaleString()} QR codes. ` +
          'Narrow the date range to export the rest.'
        );
      }
      const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const csv = [
        headers.map((h) => escape(h.label)).join(','),
        ...rows.map((row) => headers.map((h) => escape(row[h.key])).join(',')),
      ].join('\n');

      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR_Codes_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting QR codes:', err);
      setError('Could not export QR codes. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenView = (qr) => {
    setSelectedQr(qr);
    setOpenView(true);
  };

  const handleCloseView = () => {
    setOpenView(false);
    setSelectedQr(null);
  };

  const handleDateChange = (event) => {
    setDateFilter({
      ...dateFilter,
      [event.target.name]: event.target.value,
    });
  };


  const headers = [
    { label: 'ID', key: 'id' },
    { label: 'QR Code', key: 'qr_code' },
    { label: 'Payment Reference', key: 'payment_reference' },
    { label: 'Amount', key: 'amount' },
    { label: 'Status', key: 'status' },
    { label: 'Description', key: 'description' },
    { label: 'Created At', key: 'created_at' },
    { label: 'Updated At', key: 'updated_at' },
  ];

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

        <Box mb={2}>
          {/* Filter Container */}
          <Box display="flex" flexWrap="wrap" gap={2} width="100%">
            {/* First Row */}
            <Box
              display="flex"
              flexWrap="wrap"
              gap={2}
              width="100%"
              flexDirection={{ xs: 'column', sm: 'row' }}
            >
              <CustomTextField
                label="Search Payment Reference"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  flex: 1,
                  minWidth: { xs: '100%', sm: '300px' },
                  maxWidth: '400px',
                }}
              />
              <CustomTextField
                label="Start Date"
                type="date"
                variant="outlined"
                size="small"
                InputLabelProps={{ shrink: true }}
                name="startDate"
                value={dateFilter.startDate}
                onChange={handleDateChange}
                sx={{
                  flex: 1,
                  minWidth: { xs: '100%', sm: '300px' },
                  maxWidth: '400px',
                }}
              />
              <CustomTextField
                label="End Date"
                type="date"
                variant="outlined"
                size="small"
                InputLabelProps={{ shrink: true }}
                name="endDate"
                value={dateFilter.endDate}
                onChange={handleDateChange}
                sx={{
                  flex: 1,
                  minWidth: { xs: '100%', sm: '300px' },
                  maxWidth: '400px',
                }}
              />
            </Box>

            {/* Second Row */}
            <Box
              display="flex"
              flexWrap="wrap"
              gap={2}
              mt={2}
              width="100%"
              flexDirection={{ xs: 'column', sm: 'row' }}
            >
              {/* Branch Name Autocomplete */}
              <Autocomplete
                options={branches}
                getOptionLabel={(branch) => branch.branch_name || ''}
                value={branchFilter ? branches.find(b => b.branch_name === branchFilter) : null}
                onChange={(event, newValue) => setBranchFilter(newValue ? newValue.branch_name : '')}
                renderInput={(params) => (
                  <CustomTextField
                    {...params}
                    label="Branch Name"
                    variant="outlined"
                    fullWidth
                    size="small"
                    sx={{
                      flex: 1,
                      minWidth: { xs: '100%', sm: '400px' },
                      maxWidth: '500px',
                    }}
                  />
                )}
              />

              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: '200px' }, maxWidth: '260px' }}>
                <InputLabel id="qr-status-filter">Status</InputLabel>
                <Select
                  labelId="qr-status-filter"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                >
                  <MenuItem value="">All statuses</MenuItem>
                  {['paid', 'pending', 'expired', 'cancelled', 'failed'].map((s) => (
                    <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* User Name Autocomplete */}
              <Autocomplete
                options={users}
                getOptionLabel={(user) => user.username || ''}
                value={userFilter ? users.find(u => u.username === userFilter) : null}
                onChange={(event, newValue) => setUserFilter(newValue ? newValue.username : '')}
                renderInput={(params) => (
                  <CustomTextField
                    {...params}
                    label="User Name"
                    variant="outlined"
                    fullWidth
                    size="small"
                    sx={{
                      flex: 1,
                      minWidth: { xs: '100%', sm: '400px' },
                      maxWidth: '500px',
                    }}
                  />
                )}
              />
            </Box>
          </Box>
          {/* Buttons */}
          <Box mt={2} display="flex" gap={2} flexWrap="wrap" sx={{
            '@media (max-width: 735px)': {
              flexDirection: 'column',
              alignItems: 'stretch',
            },
            width: '100%',
          }}>
            <Button
              variant="contained"
              color="primary"
              sx={{
                flex: 1,
                backgroundColor: '#FBB03A',
                color: 'black',
                '&:hover': {
                  backgroundColor: '#ED1F79',
                },
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 400,
                minWidth: '120px',
                width: '100%',
                '@media (max-width: 735px)': {
                  width: '100%',
                },
              }}
              onClick={() => setPage(0)}
            >
              Apply Filters
            </Button>

            <Button
              variant="contained"
              color="secondary"
              sx={{
                flex: 1,
                backgroundColor: '#ED1F79',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#FBB03A',
                },
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 400,
                minWidth: '120px',
                width: '100%',
                '@media (max-width: 735px)': {
                  width: '100%',
                },
              }}
              onClick={() => {
                setSearchTerm('');
                setBranchFilter('');
                setUserFilter('');
                setStatusFilter('');
                setDateFilter({ startDate: '', endDate: '' });
                setPage(0);
              }}
            >
              Clear Filters
            </Button>

            <Box sx={{
              flex: 1,
              width: '100%',
              '@media (max-width: 735px)': {
                width: '100%',
              },
            }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleExportCsv}
                disabled={exporting}
                sx={{
                  flex: 1,
                  backgroundColor: '#b3b3b3',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#FBB03A',
                  },
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 400,
                  minWidth: '120px',
                  width: '100%',
                  '@media (max-width: 735px)': {
                    width: '100%',
                  },
                }}
                startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
              >
                {exporting ? 'Preparing...' : 'Export to CSV'}
              </Button>
            </Box>
          </Box>


        </Box>
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

export default ManageQrCA;
