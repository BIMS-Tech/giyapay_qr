import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    TextField, Button, Box, Typography, Container, Paper, IconButton, InputAdornment, Grid,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Collapse, Snackbar,
    Alert, FormControl, FormHelperText, InputLabel, Select, MenuItem,
    Dialog, DialogTitle, DialogContent, DialogActions, Chip, Stack, Tooltip, Divider,
} from '@mui/material';
import {
    Visibility, VisibilityOff, ExpandMore, ExpandLess, Logout,
    Add as AddIcon, Search as SearchIcon, ContentCopy as CopyIcon,
} from '@mui/icons-material';
import io from 'socket.io-client';
import CustomTextField from '../Components/Mui/CustomTextField';
import ThemeToggle from '../Components/ThemeToggle';


const MerchantManagement = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [merchantID, setMerchantID] = useState('');
    const [merchantName, setMerchantName] = useState('');
    const [merchantSecret, setMerchantSecret] = useState('');
    const [paymentUrl, setPaymentUrl] = useState('');
    const [merchantUrl, setMerchantUrl] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [gatewayAccount, setGatewayAccount] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [adminTotal, setAdminTotal] = useState(0);
    const [admins, setAdmins] = useState([]);
    const [expandedRow, setExpandedRow] = useState(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [socket, setSocket] = useState(null);

    const [errors, setErrors] = useState({});
    const [search, setSearch] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [revealedSecret, setRevealedSecret] = useState(null);

    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    useEffect(() => {
        const token = localStorage.getItem('token');
        const expirationTime = localStorage.getItem('expirationTime');
        if (token && expirationTime && Date.now() < expirationTime) {
            setIsLoggedIn(true);
        } else {
            setIsLoggedIn(false);
        }

        const checkTokenExpiration = setInterval(() => {
            const token = localStorage.getItem('token');
            const expirationTime = localStorage.getItem('expirationTime');
            if (token && expirationTime && Date.now() >= expirationTime) {
                handleLogout();
            }
        }, 60000);

        return () => clearInterval(checkTokenExpiration);
    }, []);

    useEffect(() => {
        const fetchAdminCountAndAdmins = async () => {
            try {
                // Fetch total admin count
                const countResult = await axios.get(`${backendUrl}/admin/count`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                });
                if (countResult.data.Status) {
                    setAdminTotal(countResult.data.Result);
                }

                // Fetch admin list
                const adminsResult = await axios.get(`${backendUrl}/admin/all`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                });
                setAdmins(adminsResult.data.Result);
            } catch (error) {
                console.error('Error fetching admin data:', error);
            }
        };

        fetchAdminCountAndAdmins();
    }, []);

    useEffect(() => {
        const newSocket = io(backendUrl, {
            auth: {
                token: localStorage.getItem('token'),
            },
        });

        setSocket(newSocket);

        // Listen for real-time updates to the admin list
        newSocket.on('adminListUpdated', (updatedAdminList) => {
            setAdmins(updatedAdminList);
        });

        // Clean up the connection when the component unmounts
        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [backendUrl]);

    const validateForm = () => {
        const newErrors = {};

        if (!email) newErrors.email = 'Email is required';
        if (!password) newErrors.password = 'Password is required';
        if (!merchantName) newErrors.merchantName = 'Merchant Name is required';
        if (!merchantID) newErrors.merchantID = 'Merchant ID is required';
        if (!merchantSecret) newErrors.merchantSecret = 'Merchant Secret is required';
        if (!paymentUrl) newErrors.paymentUrl = 'Payment URL is required';
        if (!merchantUrl) newErrors.merchantUrl = 'Merchant URL is required';
        if (!gatewayAccount) newErrors.gatewayAccount = 'Gateway Account Type is required';

        // Validate Payment Method only if Gateway Account is Individual
        if (gatewayAccount === 'Individual' && !paymentMethod) {
            newErrors.paymentMethod = 'Payment Method is required for Individual accounts';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };




    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("userType");
        localStorage.removeItem("expirationTime");
        setIsLoggedIn(false);
        window.location.href = '/';
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!validateForm()) return;

        const formData = {
            email,
            password,
            merchant_name: merchantName,
            merchant_id: merchantID,
            merchant_secret: merchantSecret,
            paymentUrl,
            merchant_url: merchantUrl,
            gateway_account_type: gatewayAccount,
            payment_method: gatewayAccount === 'Universal' ? null : paymentMethod,
        };

        try {
            const response = await axios.post(`${backendUrl}/admin/add`, formData, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });

            setSnackbarMessage(response.data.message);
            setSnackbarSeverity('success');
            setSnackbarOpen(true);

            // Clear form state
            setEmail('');
            setPassword('');
            setMerchantName('');
            setMerchantID('');
            setMerchantSecret('');
            setPaymentUrl('');
            setMerchantUrl('');
            setGatewayAccount('');
            setPaymentMethod('');
            setErrors({});
            setAddOpen(false);
        } catch (error) {
            console.error('Error adding admin:', error);
            setSnackbarMessage('Failed to add admin');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };



    const handleClickShowPassword = () => {
        setShowPassword(!showPassword);
    };

    const toggleRowExpansion = (rowIndex) => {
        setExpandedRow(expandedRow === rowIndex ? null : rowIndex);
    };

    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };

    // Client-side is fine here: this list is merchants, not transactions.
    const filteredAdmins = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return admins;
        return admins.filter((a) =>
            [a.merchant_name, a.merchant_id, a.email, a.merchant_url]
                .some((v) => String(v || '').toLowerCase().includes(q))
        );
    }, [admins, search]);

    const copy = (value) => {
        navigator.clipboard?.writeText(String(value ?? '')).then(
            () => {
                setSnackbarMessage('Copied to clipboard');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
            },
            () => {}
        );
    };

    const field = (label, value, setter, key, extra = {}) => (
        <CustomTextField
            label={label}
            value={value}
            onChange={(e) => setter(e.target.value)}
            fullWidth
            required
            error={!!errors[key]}
            helperText={errors[key]}
            // Stops the browser autofilling the super admin's own credentials
            // into a form that creates a different merchant's account - which
            // also left the floating label overlapping the value.
            autoComplete="off"
            {...extra}
        />
    );

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
                spacing={2}
                mb={3}
            >
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 500 }}>Merchant Management</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Add and review merchant accounts
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip label={`${adminTotal} merchant${adminTotal === 1 ? '' : 's'}`} />
                    <ThemeToggle />
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
                        Add merchant
                    </Button>
                    <Button variant="outlined" color="error" startIcon={<Logout />} onClick={handleLogout}>
                        Log out
                    </Button>
                </Stack>
            </Stack>

            <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2 }}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Search by merchant name, merchant ID, email or URL"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ maxWidth: 480 }}
                    />
                </Box>

                <Divider />

                {/* The table has more columns than fit on a laptop, so it scrolls
                    inside this container rather than overflowing the page. */}
                <TableContainer sx={{ overflowX: 'auto', maxHeight: 620 }}>
                    <Table stickyHeader size="small" sx={{ minWidth: 900 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 64 }}>ID</TableCell>
                                <TableCell>Merchant</TableCell>
                                <TableCell>Merchant ID</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Gateway</TableCell>
                                <TableCell>Payment method</TableCell>
                                <TableCell sx={{ width: 56 }} align="right">Details</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {filteredAdmins.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.disabled' }}>
                                        {admins.length === 0 ? 'No merchants yet' : 'No merchants match that search'}
                                    </TableCell>
                                </TableRow>
                            )}

                            {filteredAdmins.map((admin, index) => (
                                <React.Fragment key={admin.id}>
                                    <TableRow hover>
                                        <TableCell>{admin.id}</TableCell>
                                        <TableCell sx={{ fontWeight: 500 }}>
                                            {admin.merchant_name || <em style={{ opacity: 0.5 }}>Not set</em>}
                                        </TableCell>
                                        <TableCell>
                                            {admin.merchant_id ? (
                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                    <span>{admin.merchant_id}</span>
                                                    <Tooltip title="Copy merchant ID">
                                                        <IconButton size="small" onClick={() => copy(admin.merchant_id)}>
                                                            <CopyIcon sx={{ fontSize: 14 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            ) : <em style={{ opacity: 0.5 }}>Not set</em>}
                                        </TableCell>
                                        <TableCell sx={{ wordBreak: 'break-word' }}>{admin.email}</TableCell>
                                        <TableCell>
                                            {admin.gateway_account_type && (
                                                <Chip size="small" label={admin.gateway_account_type} variant="outlined" />
                                            )}
                                        </TableCell>
                                        <TableCell>{admin.payment_method || '—'}</TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={() => toggleRowExpansion(index)}>
                                                {expandedRow === index ? <ExpandLess /> : <ExpandMore />}
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>

                                    <TableRow>
                                        <TableCell colSpan={7} sx={{ p: 0, borderBottom: expandedRow === index ? undefined : 'none' }}>
                                            <Collapse in={expandedRow === index} timeout="auto" unmountOnExit>
                                                <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={12} md={6}>
                                                            <Typography variant="caption" color="text.secondary">Checkout URL</Typography>
                                                            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                                                {admin.paymentUrl || '—'}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={12} md={6}>
                                                            <Typography variant="caption" color="text.secondary">Merchant URL</Typography>
                                                            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                                                {admin.merchant_url || '—'}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={12}>
                                                            <Typography variant="caption" color="text.secondary">Merchant secret</Typography>
                                                            {/* Kept masked by default - it signs payment requests. */}
                                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                                                    {revealedSecret === admin.id
                                                                        ? admin.merchant_secret
                                                                        : '•'.repeat(Math.min(String(admin.merchant_secret || '').length, 24))}
                                                                </Typography>
                                                                <Button
                                                                    size="small"
                                                                    onClick={() => setRevealedSecret(revealedSecret === admin.id ? null : admin.id)}
                                                                >
                                                                    {revealedSecret === admin.id ? 'Hide' : 'Reveal'}
                                                                </Button>
                                                                <Button size="small" onClick={() => copy(admin.merchant_secret)}>Copy</Button>
                                                            </Stack>
                                                        </Grid>
                                                    </Grid>
                                                </Box>
                                            </Collapse>
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* The form only appears when you are actually adding, so the table
                gets the full width the rest of the time. */}
            <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add merchant</DialogTitle>
                <form onSubmit={handleSubmit} autoComplete="off">
                    <DialogContent dividers>
                        <Stack spacing={2}>
                            {field('Email', email, setEmail, 'email', { type: 'email' })}
                            {field('Password', password, setPassword, 'password', {
                                type: showPassword ? 'text' : 'password',
                                autoComplete: 'new-password',
                                InputProps: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={handleClickShowPassword} edge="end">
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                },
                            })}
                            {field('Merchant name', merchantName, setMerchantName, 'merchantName')}
                            {field('Merchant ID', merchantID, setMerchantID, 'merchantID')}
                            {field('Merchant secret', merchantSecret, setMerchantSecret, 'merchantSecret')}
                            {field('Checkout URL', paymentUrl, setPaymentUrl, 'paymentUrl')}
                            {field('Merchant URL', merchantUrl, setMerchantUrl, 'merchantUrl')}

                            <FormControl fullWidth required error={!!errors.gatewayAccount}>
                                <InputLabel id="gateway-account-type-label">Gateway account type</InputLabel>
                                <Select
                                    labelId="gateway-account-type-label"
                                    label="Gateway account type"
                                    value={gatewayAccount}
                                    onChange={(e) => {
                                        setGatewayAccount(e.target.value);
                                        if (e.target.value === 'Universal') setPaymentMethod('');
                                    }}
                                >
                                    <MenuItem value="Individual">Individual</MenuItem>
                                    <MenuItem value="Universal">Universal</MenuItem>
                                </Select>
                                {errors.gatewayAccount && <FormHelperText>{errors.gatewayAccount}</FormHelperText>}
                            </FormControl>

                            {gatewayAccount === 'Individual' && (
                                <FormControl fullWidth required error={!!errors.paymentMethod}>
                                    <InputLabel id="payment-method-label">Payment method</InputLabel>
                                    <Select
                                        labelId="payment-method-label"
                                        label="Payment method"
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                    >
                                        <MenuItem value="MASTERCARD/VISA">MASTERCARD/VISA</MenuItem>
                                        <MenuItem value="GCASH">GCASH</MenuItem>
                                        <MenuItem value="INSTAPAY">INSTAPAY</MenuItem>
                                    </Select>
                                    {errors.paymentMethod && <FormHelperText>{errors.paymentMethod}</FormHelperText>}
                                </FormControl>
                            )}
                        </Stack>
                    </DialogContent>

                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="contained">Add merchant</Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default MerchantManagement;
