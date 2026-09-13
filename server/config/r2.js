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

let client = null;

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

/** Slugify + de-duplicate a filename into a safe, unique object key. */
function buildKey(originalName, folder = 'products') {
  const rawExt = path.extname(originalName || '');
  const ext = rawExt.toLowerCase();
  const base = path
    .basename(originalName || 'image', rawExt)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const safeFolder = String(folder).replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'products';
  return `${safeFolder}/${base}-${unique}${ext}`;
}

/**
 * Upload a buffer to R2.
 *
 * @param {Object} opts
 * @param {Buffer} opts.buffer        File contents
 * @param {string} opts.contentType   MIME type
 * @param {string} opts.originalName  Original filename (used to derive key/extension)
 * @param {string} [opts.folder]      Logical folder prefix (default 'products')
 * @returns {Promise<{ key: string, url: string }>}
 * @throws if R2 is not configured or the upload fails
 */
async function uploadBuffer({ buffer, contentType, originalName, folder }) {
  const c = getClient();
  if (!c) {
    const err = new Error('R2 storage is not configured');
    err.code = 'R2_NOT_CONFIGURED';
    throw err;
  }

  const key = buildKey(originalName, folder);

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

module.exports = {
  isConfigured,
  uploadBuffer,
  deleteByUrlOrKey,
  publicUrl,
  buildKey,
};
