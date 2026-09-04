import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
} from '@mui/material';

import RippleLoader from '../Components/Loader';

const AfterSales = () => {
  const [loading, setLoading] = useState(true);

  const handleIframeLoad = () => {
    setLoading(false);
  };

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
          position: 'relative',
        }}
      >
        {loading && (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="100%"
          >
            <RippleLoader />
          </Box>
        )}
        <Box
          sx={{
            display: loading ? 'none' : 'block',
          }}
        >
          <iframe
            width="100%"
            height="768"
            src="https://www.wrike.com/form/eyJhY2NvdW50SWQiOjQ1ODAyMTIsInRhc2tGb3JtSWQiOjY1MTI1NH0JNDg4Njg5MjU4NDk4Mgk2MmNjZjBmNWNhYjFiOWI5Mzc3YjY4ZGM5MTZmYzM3NTUxMzA2YWNjMDQxOTU5YjQ5YjA2MDgxYjM1MTM2ZTUw"
            frameBorder="0"
            onLoad={handleIframeLoad}
            style={{
              border: 'none',
              borderRadius: '8px',
            }}
          ></iframe>
        </Box>
      </Paper>
    </Box>
  );
};

export default AfterSales;
