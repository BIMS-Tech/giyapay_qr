import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { LightMode as LightIcon, DarkMode as DarkIcon } from '@mui/icons-material';
import { useColorMode } from '../theme/ColorModeContext';

const ThemeToggle = (props) => {
  const { mode, toggleColorMode } = useColorMode();
  const nextLabel = mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <Tooltip title={nextLabel}>
      <IconButton
        onClick={toggleColorMode}
        color="inherit"
        aria-label={nextLabel}
        {...props}
      >
        {mode === 'light' ? <DarkIcon /> : <LightIcon />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
