import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Global stylesheets. These used to be imported from inside OverView.jsx,
// which meant editing that one page could silently strip Bootstrap from the
// whole application. They belong at the entry point.
// Order matters: Bootstrap first, then our theme tokens so their body rule
// wins, then the rest.
import 'bootstrap/dist/css/bootstrap.min.css'
import './css/theme.css'
import './index.css'
import './css/home.css'

import { ColorModeProvider } from './theme/ColorModeContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ColorModeProvider>
      <App />
    </ColorModeProvider>
  </React.StrictMode>,
)
