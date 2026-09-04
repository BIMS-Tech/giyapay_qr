import React from 'react';
import { TextField } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    fontFamily: 'Montserrat, sans-serif',
    fontWeight: 400,
    borderRadius: '10px',
    '& fieldset': {
      borderColor: '#e0e0e0',
      borderWidth: '1px',
    },
    '&:hover fieldset': {
      borderColor: '#000',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#000',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'var(--app-text-secondary)',
    fontFamily: 'Montserrat, sans-serif',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'var(--app-text-secondary)',
  },
}));

const CustomTextField = ({ label, ...props }) => {
  return (
    <StyledTextField
      label={label}
      variant="outlined"
      fullWidth
      {...props}
    />
  );
};

export default CustomTextField;
