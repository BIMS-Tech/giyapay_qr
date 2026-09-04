import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Typography,
  Grid,
  Avatar,
  Box,
  Paper,
  Divider
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import BadgeIcon from '@mui/icons-material/Badge';
import BranchIcon from '@mui/icons-material/Business';
import StatusIcon from '@mui/icons-material/ToggleOn';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LockIcon from '@mui/icons-material/Lock';
import RippleLoader from '../Components/Loader';

const ProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/users/profile`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        setProfile(response.data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Error fetching profile data.');
      }
    };

    fetchProfile();
  }, []);

  const renderProfileDetail = (icon, label, value) => (
    <Grid
      item
      xs={12}
      sm={6}
      display="flex"
      alignItems="flex-start"
    >
      {icon}
      <Typography
        variant="body1"
        sx={{
          marginLeft: 1,
          fontFamily: 'Montserrat, sans-serif',
          wordWrap: 'break-word',
          whiteSpace: 'normal',
          overflowWrap: 'break-word',
          overflow: 'hidden',
          maxWidth: '100%',
        }}
      >
        <strong>{label}:</strong> {value || 'N/A'}
      </Typography>
    </Grid>
  );

  if (error) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <ErrorOutlineIcon color="error" />
        <Typography color="error" variant="h6" marginLeft={1}>
          {error}
        </Typography>
      </Box>
    );
  }

  if (!profile) {
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
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="80vh"
    >
      <Paper
        sx={{
          maxWidth: 800,
          width: '100%',
          padding: 3,
          borderRadius: 2,
          backgroundColor: 'var(--app-surface)',
        }}
      >
        <Box display="flex" justifyContent="center" marginBottom={2}>
          <Avatar
            sx={{
              background: 'linear-gradient(to right, #FBB03A, #ED1F79)',
              width: 80,
              height: 80,
            }}
          >
            <AccountCircleIcon sx={{ fontSize: 50, color: 'white' }} />
          </Avatar>
        </Box>

        <Typography
          variant="h4"
          align="center"
          gutterBottom
          sx={{ fontFamily: 'Montserrat, sans-serif' }}
        >
          {profile.user_type === 'admin' ? 'Admin Profile' : 'User Profile'}
        </Typography>

        {/* Personal Details Section */}
        <Box marginBottom={3}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              marginBottom: 2,
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            Personal Details
          </Typography>
          <Grid container spacing={2}>
            {renderProfileDetail(
              <BadgeIcon sx={{ color: '#ED1F79' }} />,
              'ID',
              profile.id
            )}
            {profile.user_type === 'admin' ? (
              <>
                {renderProfileDetail(
                  <EmailIcon sx={{ color: '#ED1F79' }} />,
                  'Email',
                  profile.email
                )}
                {renderProfileDetail(
                  <PersonIcon sx={{ color: '#ED1F79' }} />,
                  'Merchant Name',
                  profile.merchant_name
                )}
                {renderProfileDetail(
                  <LockIcon sx={{ color: '#ED1F79' }} />,
                  'Merchant Secret',
                  profile.merchant_secret
                )}
              </>
            ) : (
              <>
                {renderProfileDetail(
                  <PersonIcon sx={{ color: '#ED1F79' }} />,
                  'First Name',
                  profile.first_name
                )}
                {renderProfileDetail(
                  <PersonIcon sx={{ color: '#ED1F79' }} />,
                  'Last Name',
                  profile.last_name
                )}
                {renderProfileDetail(
                  <BadgeIcon sx={{ color: '#ED1F79' }} />,
                  'Username',
                  profile.username
                )}
                {renderProfileDetail(
                  <EmailIcon sx={{ color: '#ED1F79' }} />,
                  'Email',
                  profile.email
                )}
                {renderProfileDetail(
                  <StatusIcon sx={{ color: '#ED1F79' }} />,
                  'Status',
                  profile.status
                )}
              </>
            )}
          </Grid>
        </Box>

        <Divider sx={{ marginBottom: 2 }} />

        {/* Branch Information Section */}
        {profile.branch && (
          <Box marginBottom={3}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                marginBottom: 2,
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              Branch Information
            </Typography>
            <Grid container spacing={2}>
              {renderProfileDetail(
                <BranchIcon sx={{ color: '#ED1F79' }} />,
                'Branch Name',
                profile.branch.branch_name
              )}
            </Grid>
          </Box>
        )}

        {/* Merchant Information Section */}
        {profile.user_type !== 'admin' && (
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                marginBottom: 2,
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              Merchant Information
            </Typography>
            <Grid container spacing={2}>
              {renderProfileDetail(
                <PersonIcon sx={{ color: '#ED1F79' }} />,
                'Merchant ID',
                profile.merchant_id
              )}
              {renderProfileDetail(
                <PersonIcon sx={{ color: '#ED1F79' }} />,
                'Merchant Name',
                profile.merchant_name
              )}
              {renderProfileDetail(
                <LockIcon sx={{ color: '#ED1F79' }} />,
                'Merchant Secret',
                profile.merchant_secret
              )}
            </Grid>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ProfilePage;
