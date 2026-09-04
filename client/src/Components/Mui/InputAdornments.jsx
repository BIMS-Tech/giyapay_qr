import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { styled } from '@mui/material/styles';

const CustomOutlinedInput = styled(OutlinedInput)(({ theme }) => ({
  fontFamily: 'Montserrat, sans-serif',
  borderRadius: '10px',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#e0e0e0',
    borderWidth: '1px',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#e0e0e0',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#000000',
  },
  '& .MuiInputAdornment-root': {
    color: 'var(--app-text)',
  },
}));

const CustomInputLabel = styled(InputLabel)(({ theme }) => ({
  fontFamily: 'Montserrat, sans-serif',
  color: 'var(--app-text-secondary)',
  '&.Mui-focused': {
    color: 'var(--app-text)',
  },
}));


export default function InputAdornments({ label, type, value, onChange, placeholder, variant }) {
  const [showPassword, setShowPassword] = React.useState(type === 'password' ? false : undefined);

  const handleClickShowPassword = () => {
    if (type === 'password') {
      setShowPassword((show) => !show);
    }
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  return (
    <FormControl sx={{ m: 1, width: '100%' }} variant={variant} fullWidth>
      <CustomInputLabel htmlFor={`${variant}-adornment-${label.toLowerCase()}`}>{label}</CustomInputLabel>
      <CustomOutlinedInput
        id={`${variant}-adornment-${label.toLowerCase()}`}
        type={type === 'password' ? (showPassword ? 'text' : 'password') : type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        endAdornment={
          type === 'password' ? (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleClickShowPassword}
                onMouseDown={handleMouseDownPassword}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ) : null
        }
        label={label}
        fullWidth
      />
    </FormControl>
  );
}
