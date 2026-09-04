import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const navigate = useNavigate();

    const goBack = () => {
        navigate(-1);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: 'var(--app-surface)',
                textAlign: 'center',
                padding: 2
            }}
        >
            {/* Large and bold 404 text */}
            <Typography
                variant="h1"
                sx={{
                    fontSize: 120,
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #f5c518, #e91e63)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '20px',
                }}
            >
                404
            </Typography>

            {/* Main error message */}
            <Typography
                variant="h5"
                sx={{
                    fontSize: 24,
                    fontWeight: 'medium',
                    background: 'linear-gradient(45deg, #f5c518, #e91e63)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '20px',
                }}
            >
                Oops! The page you're looking for doesn't exist.
            </Typography>

            {/* Extra helping text */}
            <Typography
                variant="body1"
                sx={{
                    color: 'var(--app-text)',
                    marginBottom: '30px',
                    maxWidth: '600px',
                    textAlign: 'left'
                }}
            >
                You might be seeing this page because:
                <ul style={{ marginLeft: '20px', lineHeight: '1.6' }}>
                    <li><strong>Incorrect URL:</strong> You may have entered a wrong or broken link.</li>
                    <li><strong>Not Logged In:</strong> You tried to access a private page without logging in.</li>
                    <li><strong>Page Moved or Deleted:</strong> The page you are looking for might have been moved or removed.</li>
                </ul>
            </Typography>

            {/* Wider button with less height */}
            <Button
                variant="contained"
                onClick={goBack}
                sx={{
                    background: 'linear-gradient(45deg, #f5c518, #e91e63)',
                    color: '#fff',
                    padding: '10px 50px',
                    fontSize: '18px',
                    textTransform: 'none',
                    '&:hover': {
                        background: 'linear-gradient(45deg, #e91e63, #f5c518)',
                    }
                }}
            >
                Go Back
            </Button>

            {/* Additional Information */}
            <Typography
                variant="body2"
                sx={{
                    color: 'var(--app-text)',
                    marginTop: '20px',
                    maxWidth: '600px',
                    textAlign: 'left',
                    lineHeight: '1.6'
                }}
            >
                Here’s what you can do:
                <ul style={{ marginLeft: '20px' }}>
                    <li><strong>Go Back:</strong> Click the button above to return to the previous page.</li>
                    <li><strong>Login:</strong> If you were trying to access a private page, please <a href="/" style={{ color: '#e91e63' }}>log in</a> and try again.</li>
                    <li><strong>Need Help?</strong> If you continue to see this page, please <a href="/contact" style={{ color: '#e91e63' }}>contact support</a> for assistance.</li>
                </ul>
            </Typography>
        </Box>
    );
};

export default NotFound;
