// Centralized configuration for the frontend.
// Values are read from environment variables (set in .env) with sensible
// development fallbacks so the app works out-of-the-box locally.

export const API_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5001';

export const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

// Optional public base for images stored in Cloudflare R2. In most setups the
// backend already returns fully-qualified R2 URLs, so this is only used as a
// fallback to rewrite bare object keys (e.g. "products/foo.webp") into URLs.
// Set REACT_APP_IMAGE_BASE_URL to your R2 public/custom-domain base if needed.
export const IMAGE_BASE_URL = (
  process.env.REACT_APP_IMAGE_BASE_URL || ''
).replace(/\/+$/, '');

/**
 * Resolve a stored image value into a usable <img src>.
 *
 * Handles every value shape the app may hold, in priority order:
 *   1. Empty / missing            → '' (callers render a placeholder)
 *   2. Absolute URL (http/https)  → used as-is (R2 public URL, external CDN)
 *   3. data:/blob: URIs           → used as-is (local previews)
 *   4. Site-root path "/foo.png"  → used as-is (legacy assets in public/)
 *   5. Bare R2 object key "a/b.png" → prefixed with IMAGE_BASE_URL when set,
 *                                     otherwise treated as a root path.
 *
 * This keeps legacy /public paths working while transparently supporting the
 * fully-qualified R2 URLs returned by the upload endpoint.
 */
export function imageUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const v = value.trim();
  if (!v) return '';
  if (/^(https?:)?\/\//i.test(v) || /^(data|blob):/i.test(v)) return v;
  if (v.startsWith('/')) return v;
  // Bare object key
  return IMAGE_BASE_URL ? `${IMAGE_BASE_URL}/${v}` : `/${v}`;
}
