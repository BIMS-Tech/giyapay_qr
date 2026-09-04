import React, { useState, useEffect } from 'react';
import { TextField, Button, FormControl, Snackbar, Alert, Box, Typography, IconButton, InputAdornment, Autocomplete, Grid, Paper } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CustomTextField from '../Mui/CustomTextField';

const AddUser = () => {
  const navigate = useNavigate();
  const [userType, setUserType] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [branchUser, setBranchUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [adminId, setAdminId] = useState(null);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);

  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const { id } = response.data;
        setAdminId(id);
      } catch (error) {
        console.error('Failed to fetch admin details:', error);
      }
    };

    fetchAdminProfile();
  }, []);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/branches/all`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setBranches(response.data);
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };
    fetchBranches();
  }, []);

  // Handle real-time username validation
  const handleUsernameChange = async (e) => {
    const newValue = e.target.value;
    setUsername(newValue);

    if (newValue) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/user/check-username/${newValue}`);
        setUsernameTaken(response.data.exists);
      } catch (error) {
        console.error('Error checking username:', error);
      }
    }
  };

  // Handle real-time email validation
  const handleEmailChange = async (e) => {
    const newValue = e.target.value;
    setEmail(newValue);

    if (newValue) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/user/check-email/${newValue}`);
        const adminResponse = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/admin/check-email/${newValue}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        if (response.data.exists || adminResponse.data.exists) {
          setEmailTaken(true);
        } else {
          setEmailTaken(false);
        }
      } catch (error) {
        console.error('Error checking email:', error);
      }
    }
  };



  const handleSave = async () => {
    setIsFormSubmitted(true);
    if (!firstName || !lastName || !username || !email || !password || !confirmPassword) {
      return showSnackbarWithMessage('All fields are required!', 'error');
    }

    if (password !== confirmPassword) {
      return showSnackbarWithMessage('Passwords do not match!', 'error');
    }

    const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    if (!emailPattern.test(email)) {
      return showSnackbarWithMessage('Please enter a valid email address!', 'error');
    }
    if (usernameTaken || emailTaken) {
      setSnackbarMessage('Username or email is already taken.');
      setSnackbarSeverity('error');
      setShowSnackbar(true);
      return;
    }

    try {
      const userData = {
        firstName,
        lastName,
        username,
        email,
        password,
        userType,
        branchId: branchUser ? branchUser.id : null,
        adminId,
      };

      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/users/add`, userData);
      showSnackbarWithMessage('User added successfully', 'success');
      setTimeout(() => {
        navigate('/super-dashboard/manage-users');
      }, 1500);
    } catch (error) {
      console.error('Failed to save the user:', error);
      showSnackbarWithMessage('Error adding user', 'error');
    }
  };

  const showSnackbarWithMessage = (message, severity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setShowSnackbar(true);
  };

  const handleCancel = () => {
    navigate('/super-dashboard/manage-users');
  };

  const handleCloseSnackbar = () => {
    setShowSnackbar(false);
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
      <Paper elevation={3} sx={{ p: 4, maxWidth: '600px', width: '100%' }}>
        <Typography variant="h4" align="center" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Add User</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth margin="normal">
              <Autocomplete
                options={['Co-Admin', 'Branch User']}
                renderInput={(params) => (
                  <CustomTextField{...params} label="User Type" required />
                )}
                value={userType}
                onChange={(e, newValue) => setUserType(newValue)}
              />
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <CustomTextField
              label="First Name"
              fullWidth
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              error={isFormSubmitted && !firstName}
              helperText={isFormSubmitted && !firstName && 'First name is required'}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <CustomTextField
              label="Last Name"
              fullWidth
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              error={isFormSubmitted && !lastName}
              helperText={isFormSubmitted && !lastName && 'Last name is required'}
            />
          </Grid>
          <Grid item xs={12}>
            <CustomTextField
              label="Username"
              fullWidth
              value={username}
              onChange={handleUsernameChange}
              required
              error={usernameTaken}
              helperText={usernameTaken ? 'Username is already taken' : ''}
            />
          </Grid>

          <Grid item xs={12}>
            <CustomTextField
              label="Email"
              fullWidth
              value={email}
              onChange={handleEmailChange}
              required
              error={emailTaken}
              helperText={emailTaken ? 'Email is already taken' : ''}
            />
          </Grid>

          <Grid item xs={12}>
            <CustomTextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              error={isFormSubmitted && !password}
              helperText={isFormSubmitted && !password && 'Password is required'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <CustomTextField
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              error={isFormSubmitted && !confirmPassword || confirmPassword !== password}
              helperText={isFormSubmitted && !confirmPassword ? 'Confirm password is required' : confirmPassword !== password ? 'Passwords do not match' : ''}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {userType === 'Branch User' && (
            <Grid item xs={12}>
              <Autocomplete
                options={branches}
                getOptionLabel={(branch) => branch.branch_name}
                value={branchUser}
                onChange={(e, newValue) => setBranchUser(newValue)}
                renderInput={(params) => <CustomTextField {...params} label="Select Branch (Optional)" />}
                fullWidth
              />
            </Grid>
          )}

          {error && (
            <Grid item xs={12}>
              <Typography color="error" align="center" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{error}</Typography>
            </Grid>
          )}

          <Grid item xs={12}>
            <Box
              display="flex"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={2}
              sx={{
                '@media (max-width: 440px)': {
                  flexDirection: 'column',
                  justifyContent: 'center',
                },
              }}
            >
              <Button
                variant="outlined"
                color="secondary"
                sx={{
                  maxWidth: '150px',
                  flex: 1,
                  backgroundColor: '#FBB03A',
                  color: 'black',
                  '&:hover': {
                    backgroundColor: '#ED1F79',
                  },
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 400,
                  minWidth: '120px',
                  '@media (max-width: 440px)': {
                    maxWidth: '100%',
                  },
                }}
                onClick={handleCancel}
              >
                Cancel
              </Button>

              <Button
                variant="contained"
                color="primary"
                sx={{
                  maxWidth: '150px',
                  flex: 1,
                  backgroundColor: '#ED1F79',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#FBB03A',
                  },
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 400,
                  minWidth: '120px',
                  '@media (max-width: 440px)': {
                    maxWidth: '100%',
                  },
                }}
                onClick={handleSave}
              >
                Save
              </Button>
            </Box>

          </Grid>
        </Grid>
      </Paper>

      {/* Snackbar component */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AddUser;
