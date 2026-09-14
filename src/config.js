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

// Preferred → smaller fallback order, so a missing exact size degrades to the
// nearest sensible variant rather than to nothing.
const SIZE_FALLBACK = {
  icon: ['icon', 'thumb', 'small', 'medium', 'large', 'original'],
  thumb: ['thumb', 'small', 'icon', 'medium', 'large', 'original'],
  small: ['small', 'medium', 'thumb', 'large', 'original'],
  medium: ['medium', 'large', 'small', 'original'],
  large: ['large', 'original', 'medium'],
  original: ['original', 'large', 'medium'],
};

/**
 * Resolve the best <img src> for an item at a requested responsive size.
 *
 * Reads the item's `imageSizes` map (produced on upload) and picks the
 * requested `size`, degrading through a sensible fallback chain, then finally
 * to the legacy single `image` string. Accepts either an item object
 * ({ image, imageSizes }) or a plain string (treated as the only source).
 *
 * @param {Object|string} item  product/category object, or a raw image value
 * @param {('icon'|'thumb'|'small'|'medium'|'large'|'original')} [size='medium']
 * @returns {string} usable <img src>, or '' when nothing is available
 */
export function imageUrlSized(item, size = 'medium') {
  if (!item) return '';
  if (typeof item === 'string') return imageUrl(item);

  const sizes = item.imageSizes;
  if (sizes && typeof sizes === 'object') {
    const chain = SIZE_FALLBACK[size] || SIZE_FALLBACK.medium;
    for (const name of chain) {
      if (sizes[name]) return imageUrl(sizes[name]);
    }
  }
  return imageUrl(item.image || '');
}

// Pixel widths for the responsive variants, mirroring the server's IMAGE_SIZES.
// `original` is omitted here since its width is unknown to the client.
const SIZE_WIDTHS = {
  icon: 64,
  thumb: 160,
  small: 320,
  medium: 640,
  large: 1280,
};

/**
 * Build a width-descriptor `srcset` from an item's `imageSizes` map so the
 * browser can pick the sharpest variant for the element's rendered size and
 * device pixel ratio. Returns '' when no size map is available (callers should
 * fall back to a plain `src` via imageUrlSized).
 *
 * @param {Object|string} item
 * @param {string[]} [names]  which variants to include (default small→large)
 * @returns {string} e.g. "https://…/320.webp 320w, https://…/640.webp 640w"
 */
export function imageSrcSet(item, names = ['small', 'medium', 'large']) {
  if (!item || typeof item !== 'object') return '';
  const sizes = item.imageSizes;
  if (!sizes || typeof sizes !== 'object') return '';

  const parts = [];
  for (const name of names) {
    const url = sizes[name];
    const width = SIZE_WIDTHS[name];
    if (url && width) parts.push(`${imageUrl(url)} ${width}w`);
  }
  return parts.join(', ');
}
