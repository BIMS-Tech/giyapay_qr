import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const STORAGE_KEY = 'giyapay-color-mode';

const ColorModeContext = createContext({ mode: 'light', toggleColorMode: () => {} });

export const useColorMode = () => useContext(ColorModeContext);

const readInitialMode = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Private windows and blocked site data throw on access; fall through.
  }
  return 'light';
};

export const ColorModeProvider = ({ children }) => {
  const [mode, setMode] = useState(readInitialMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Not fatal - the choice just will not survive a reload.
    }
    // Two attributes, two systems. data-theme drives this app's own CSS
    // tokens (css/theme.css); data-bs-theme is Bootstrap 5.3's native dark
    // mode, which repaints every Bootstrap component - cards, tables, forms,
    // modals, dropdowns - without us hand-writing an override for each.
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-bs-theme', mode);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleColorMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
    }),
    [mode]
  );

  // Deliberately minimal. The app was built against a bare createTheme(), and
  // it layers Bootstrap, react-bootstrap and mdb-react-ui-kit on top of MUI.
  // Overriding the palette, typography or baseline here changes the look of
  // every existing screen, so this adds the colour mode and nothing else:
  // in light mode the theme is identical to what shipped before.
  //
  // No CssBaseline either - MUI's reset fights Bootstrap's. Dark-mode page
  // chrome is handled by the [data-theme="dark"] rules in dashboard.css.
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'dark' && {
            background: { default: '#12141a', paper: '#1b1f27' },
          }),
        },
      }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ColorModeContext.Provider>
  );
};
