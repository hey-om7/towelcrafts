/**
 * Upload brand "app essentials" (logo variations + key icons) to Cloudflare R2
 * under a stable, predictable prefix so they can be referenced from emails, the
 * site, receipts, social, etc. — and swapped without a redeploy.
 *
 * Keys are STABLE (no hashes/timestamps) so the public URLs never change:
 *
 *   app-essentials/logo/towelcrafts-logo.png        full-res PNG (transparent)
 *   app-essentials/logo/towelcrafts-logo.webp       full-res WebP
 *   app-essentials/logo/towelcrafts-logo-512.png    512px PNG
 *   app-essentials/logo/towelcrafts-logo-192.png    192px PNG
 *   app-essentials/logo/towelcrafts-logo-128.png    128px PNG (email-sized)
 *   app-essentials/logo/towelcrafts-logo-64.png     64px PNG (favicon-sized)
 *   app-essentials/icons/apple-touch-icon.png       apple touch icon
 *   app-essentials/icons/favicon.ico                favicon
 *
 * Because keys are stable we re-upload (overwrite) on each run — safe to run
 * repeatedly. Note: objects are written with a long immutable Cache-Control,
 * so if you replace a logo you may need to cache-bust consumers or purge the
 * CDN cache for that key.
 *
 * Usage:
 *   node uploadAppEssentials.js            # upload
 *   node uploadAppEssentials.js --dry-run  # print what would happen
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

dotenv.config();

// Reuse the app's configured R2 client + helpers.
const r2 = require('./config/r2');

const DRY_RUN = process.argv.includes('--dry-run');
const PUBLIC = path.join(__dirname, '..', 'public');
const SRC_LOGO = path.join(PUBLIC, 'towelcrafts-logo.png');

// Pull the private client via a tiny put helper that mirrors config/r2 putObject
// but with our own explicit (stable) keys + shorter cache for the logo so it can
// be updated without waiting a year.
const { S3Client } = require('@aws-sdk/client-s3');
function makeClient() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT
      ? process.env.R2_ENDPOINT.replace(/\/+$/, '')
      : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

const publicBase = () => (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
const urlFor = (key) => (publicBase() ? `${publicBase()}/${key}` : `/${key}`);

async function put(client, key, body, contentType) {
  if (DRY_RUN) {
    console.log(`  [dry-run] ${key}  (${contentType}, ${body.length} bytes)  -> ${urlFor(key)}`);
    return urlFor(key);
  }
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Brand assets change rarely but should be replaceable within a day.
      CacheControl: 'public, max-age=86400',
    })
  );
  console.log(`  ✔ ${key}  -> ${urlFor(key)}`);
  return urlFor(key);
}

async function run() {
  if (!r2.isConfigured()) {
    console.error(
      '\n❌ R2 is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, ' +
        'R2_ACCOUNT_ID (or R2_ENDPOINT) and R2_PUBLIC_URL in server/.env first.\n'
    );
    process.exit(1);
  }
  if (!fs.existsSync(SRC_LOGO)) {
    console.error(`\n❌ Source logo not found at ${SRC_LOGO}\n`);
    process.exit(1);
  }

  const client = makeClient();
  const src = fs.readFileSync(SRC_LOGO);
  const results = {};

  console.log(`\n📦 Uploading app essentials to bucket "${process.env.R2_BUCKET}"${DRY_RUN ? ' (dry run)' : ''}...\n`);
  console.log('Logo:');

  // Full-res PNG (kept transparent) and WebP.
  results.logoPng = await put(client, 'app-essentials/logo/towelcrafts-logo.png', src, 'image/png');
  const fullWebp = await sharp(src).webp({ quality: 90 }).toBuffer();
  results.logoWebp = await put(client, 'app-essentials/logo/towelcrafts-logo.webp', fullWebp, 'image/webp');

  // Sized PNG variants (transparent background, never upscaled beyond source).
  for (const size of [512, 192, 128, 64]) {
    const buf = await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    results[`logo${size}`] = await put(
      client,
      `app-essentials/logo/towelcrafts-logo-${size}.png`,
      buf,
      'image/png'
    );
  }

  // Existing icons (uploaded as-is if present).
  console.log('\nIcons:');
  const icons = [
    ['apple-touch-icon.png', 'image/png'],
    ['favicon.ico', 'image/x-icon'],
    ['logo512.png', 'image/png'],
    ['logo192.png', 'image/png'],
  ];
  for (const [name, ct] of icons) {
    const p = path.join(PUBLIC, name);
    if (!fs.existsSync(p)) {
      console.log(`  – skipped ${name} (not found)`);
      continue;
    }
    await put(client, `app-essentials/icons/${name}`, fs.readFileSync(p), ct);
  }

  console.log('\n✅ Done.\n');
  console.log('Canonical logo URL (PNG):', results.logoPng);
  console.log('Canonical logo URL (WebP):', results.logoWebp);
  console.log('');
}

run().catch((err) => {
  console.error('\n❌ Upload failed:', err.message, '\n');
  process.exit(1);
});
