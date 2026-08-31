import React from 'react';
import ReactDOM from 'react-dom/client';

// Vendor styles first so our design system (index.css) and component styles
// reliably override Bootstrap's Reboot + component base classes.
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

import App from './App';
import reportWebVitals from './reportWebVitals';

import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from './config';

// Enable scroll-reveal hiding only when the browser can actually reveal
// content (IntersectionObserver present + motion allowed). Set before render
// so there is no flash of hidden content, and content stays visible otherwise.
try {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduceMotion) {
    document.documentElement.classList.add('reveal-on');
  }
} catch (e) {
  /* leave content visible */
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

reportWebVitals();
