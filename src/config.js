// Centralized configuration for the frontend.
// Values are read from environment variables (set in .env) with sensible
// development fallbacks so the app works out-of-the-box locally.

export const API_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5001';

export const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
