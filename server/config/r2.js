/**
 * Cloudflare R2 storage client (S3-compatible).
 *
 * Credentials are read from environment variables (see server/.env):
 *   R2_ACCOUNT_ID          Cloudflare account id (for the S3 endpoint host)
 *   R2_ENDPOINT            Optional explicit S3 endpoint; overrides account-id host
 *   R2_ACCESS_KEY_ID       R2 API token access key
 *   R2_SECRET_ACCESS_KEY   R2 API token secret
 *   R2_BUCKET              Target bucket name
 *   R2_PUBLIC_URL          Public base URL for reading objects
 *                          (custom domain or the r2.dev subdomain, no trailing slash)
 *
 * If the required variables are not configured, R2 is treated as disabled and
 * callers can fall back gracefully instead of crashing — mirroring the mailer.
 */
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');
const sharp = require('sharp');

let client = null;

/**
 * Responsive size presets. Each variant is resized to fit within `width`
 * (never upscaled) and re-encoded to WebP. `original` keeps the full-size
 * image (re-encoded to WebP, no resize) so a high-res source is always kept.
 *
 * Ordered smallest → largest. `medium` is the sensible default `image` string
 * used across the storefront; `icon`/`thumb` are for fast-loading small spots.
 */
const IMAGE_SIZES = {
  icon: 64,
  thumb: 160,
  small: 320,
  medium: 640,
  large: 1280,
  original: null, // no resize — full resolution, re-encoded to WebP
};

/** MIME types that sharp cannot/should not raster-resize (kept as-is). */
const PASSTHROUGH_MIME = new Set(['image/svg+xml', 'image/gif']);

function isConfigured() {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID)
  );
}

function getEndpoint() {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT.replace(/\/+$/, '');
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function getClient() {
  if (!isConfigured()) return null;
  if (client) return client;

  client = new S3Client({
    region: 'auto',
    endpoint: getEndpoint(),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

/** Base public URL (no trailing slash) used to build readable object URLs. */
function publicBase() {
  const base = process.env.R2_PUBLIC_URL || '';
  return base.replace(/\/+$/, '');
}

/**
 * Build the public URL for a stored object key.
 * Falls back to a root-relative "/<key>" path if no public base is configured,
 * so the value is still a usable, non-broken reference in development.
 */
function publicUrl(key) {
  const base = publicBase();
  return base ? `${base}/${key}` : `/${key}`;
}

/** Sanitize a logical folder prefix into a safe, slash-scoped path. */
function safeFolder(folder = 'products') {
  return (
    String(folder)
      .replace(/[^a-z0-9/_-]/gi, '')
      .replace(/^\/+|\/+$/g, '') || 'products'
  );
}

/** Slugify a filename basename into a URL-safe stem (no extension). */
function slugifyName(originalName) {
  const rawExt = path.extname(originalName || '');
  return (
    path
      .basename(originalName || 'image', rawExt)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image'
  );
}

/**
 * Build a single unique object key (legacy single-file uploads).
 * e.g. products/luxury-towel-1737045-a1b2c3d4.webp
 */
function buildKey(originalName, folder = 'products') {
  const ext = path.extname(originalName || '').toLowerCase();
  const base = slugifyName(originalName);
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  return `${safeFolder(folder)}/${base}-${unique}${ext}`;
}

/**
 * Build a unique per-upload folder for one image and all its size variants.
 * Every upload gets its own directory so its variants live together and never
 * collide with other uploads:
 *   products/luxury-towel-1737045-a1b2c3d4/
 *     64.webp  160.webp  320.webp  640.webp  1280.webp  original.webp
 *
 * Returns the folder prefix WITHOUT a trailing slash.
 */
function buildUploadDir(originalName, folder = 'products') {
  const base = slugifyName(originalName);
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  return `${safeFolder(folder)}/${base}-${unique}`;
}

/**
 * Filename (within an upload's folder) for a given size preset.
 * Named by pixel width so the file is self-describing (e.g. "320.webp"),
 * with the full-resolution copy stored as "original.webp".
 */
function variantFilename(sizeName, width, ext = '.webp') {
  return width ? `${width}${ext}` : `${sizeName}${ext}`;
}

/** Put a single buffer at an explicit key. Returns { key, url }. */
async function putObject(key, buffer, contentType) {
  const c = getClient();
  if (!c) {
    const err = new Error('R2 storage is not configured');
    err.code = 'R2_NOT_CONFIGURED';
    throw err;
  }
  await c.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
      // R2 buckets are private by default; public reads are served via the
      // configured R2_PUBLIC_URL (r2.dev subdomain or a custom domain binding).
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  return { key, url: publicUrl(key) };
}

/**
 * Upload a buffer to R2 as a single object (used by legacy /multiple route).
 *
 * @param {Object} opts
 * @param {Buffer} opts.buffer        File contents
 * @param {string} opts.contentType   MIME type
 * @param {string} opts.originalName  Original filename (used to derive key/extension)
 * @param {string} [opts.folder]      Logical folder prefix (default 'products')
 * @returns {Promise<{ key: string, url: string }>}
 */
async function uploadBuffer({ buffer, contentType, originalName, folder }) {
  const key = buildKey(originalName, folder);
  return putObject(key, buffer, contentType);
}

/**
 * Upload an image and generate multiple responsive size variants.
 *
 * Raster images (JPEG/PNG/WebP/AVIF) are resized with sharp into every preset
 * in IMAGE_SIZES and re-encoded to WebP. Vector/animated images (SVG, GIF) are
 * uploaded once, unmodified, and every size key points at that same object so
 * callers always get a complete `sizes` map regardless of source type.
 *
 * @param {Object} opts
 * @param {Buffer} opts.buffer
 * @param {string} opts.contentType
 * @param {string} opts.originalName
 * @param {string} [opts.folder]
 * @returns {Promise<{
 *   url: string,                 // default display URL (medium, or the source for passthrough)
 *   key: string,                 // key of the default display object
 *   sizes: Record<string,string> // { icon, thumb, small, medium, large, original }
 * }>}
 */
async function uploadImageVariants({ buffer, contentType, originalName, folder }) {
  if (!getClient()) {
    const err = new Error('R2 storage is not configured');
    err.code = 'R2_NOT_CONFIGURED';
    throw err;
  }

  // SVG / GIF: store once as-is inside its own upload folder; all size keys
  // reference that single object so callers still get a complete sizes map.
  if (PASSTHROUGH_MIME.has(contentType)) {
    const dir = buildUploadDir(originalName, folder);
    const ext = path.extname(originalName || '').toLowerCase() || '.bin';
    const key = `${dir}/original${ext}`;
    const { url } = await putObject(key, buffer, contentType);
    const sizes = Object.fromEntries(Object.keys(IMAGE_SIZES).map((name) => [name, url]));
    return { url, key, sizes };
  }

  const dir = buildUploadDir(originalName, folder);

  // Read intrinsic width once so we never upscale beyond the source.
  let sourceWidth = Infinity;
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.width) sourceWidth = meta.width;
  } catch {
    /* fall back to resizing every preset if metadata is unavailable */
  }

  const entries = await Promise.all(
    Object.entries(IMAGE_SIZES).map(async ([name, width]) => {
      const pipeline = sharp(buffer).rotate(); // honor EXIF orientation
      if (width && width < sourceWidth) {
        pipeline.resize({ width, withoutEnlargement: true });
      }
      const out = await pipeline.webp({ quality: name === 'icon' ? 78 : 82 }).toBuffer();
      const key = `${dir}/${variantFilename(name, width)}`;
      const { url } = await putObject(key, out, 'image/webp');
      return [name, url];
    })
  );

  const sizes = Object.fromEntries(entries);
  // `medium` is the storefront default; fall back to large/original if missing.
  const url = sizes.medium || sizes.large || sizes.original;
  const key = `${dir}/${variantFilename('medium', IMAGE_SIZES.medium)}`;
  return { url, key, sizes };
}

/**
 * Delete an object from R2 by key OR by a full/public URL that points at the
 * configured bucket. No-op (resolves false) for values that aren't R2 objects
 * (e.g. legacy /public paths) so callers can safely fire it on any image value.
 */
async function deleteByUrlOrKey(value) {
  const c = getClient();
  if (!c || !value) return false;

  let key = value;
  const base = publicBase();
  if (base && value.startsWith(base + '/')) {
    key = value.slice(base.length + 1);
  } else if (/^https?:\/\//i.test(value)) {
    // A full URL that isn't on our public base — not ours to delete.
    return false;
  } else if (value.startsWith('/')) {
    // Legacy site-root-relative path (served from public/) — not an R2 object.
    return false;
  }

  await c.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key.replace(/^\/+/, ''),
    })
  );
  return true;
}

/**
 * Delete every variant referenced by a sizes map (or a single value).
 * De-duplicates keys so passthrough images (all sizes → one object) delete once.
 * @param {Record<string,string>|string} sizesOrValue
 * @returns {Promise<number>} count of objects deleted
 */
async function deleteVariants(sizesOrValue) {
  if (!getClient() || !sizesOrValue) return 0;
  const values =
    typeof sizesOrValue === 'string' ? [sizesOrValue] : Object.values(sizesOrValue || {});
  const unique = [...new Set(values.filter(Boolean))];
  const results = await Promise.all(
    unique.map((v) => deleteByUrlOrKey(v).catch(() => false))
  );
  return results.filter(Boolean).length;
}

module.exports = {
  isConfigured,
  uploadBuffer,
  uploadImageVariants,
  deleteByUrlOrKey,
  deleteVariants,
  publicUrl,
  buildKey,
  IMAGE_SIZES,
};
