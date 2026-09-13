/**
 * One-off migration: push existing images from the CRA `public/` folder into
 * Cloudflare R2 and rewrite the database references to the resulting public
 * URLs.
 *
 * Safe to re-run (idempotent):
 *   - Values that are already absolute URLs (http/https) are left untouched.
 *   - Each distinct local path is uploaded once per run and cached.
 *   - A manifest (server/r2-migration-map.json) records path -> URL so the
 *     seed script and future runs can reuse the mapping.
 *
 * Usage (from the server/ directory):
 *   node migrateImagesToR2.js            # upload + rewrite DB
 *   node migrateImagesToR2.js --dry-run  # report what would change, no writes
 *
 * Requires R2_* variables configured in server/.env.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const r2 = require('./config/r2');
const Product = require('./models/Product');
const Category = require('./models/Category');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const MANIFEST_PATH = path.resolve(__dirname, 'r2-migration-map.json');
const DRY_RUN = process.argv.includes('--dry-run');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function isAbsoluteUrl(v) {
  return typeof v === 'string' && /^(https?:)?\/\//i.test(v);
}

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveManifest(map) {
  if (DRY_RUN) return;
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(map, null, 2) + '\n');
}

/**
 * Upload one local /public path to R2 (once). Returns the public URL, or null
 * if the file doesn't exist locally. Uses/updates the in-memory cache + manifest.
 */
async function migratePath(localPath, cache, folder) {
  if (!localPath || isAbsoluteUrl(localPath)) return localPath || null;

  // Normalize "/foo.png" -> "foo.png" relative to public/
  const rel = localPath.replace(/^\/+/, '');
  if (cache[localPath]) return cache[localPath];

  const abs = path.join(PUBLIC_DIR, rel);
  if (!fs.existsSync(abs)) {
    console.warn(`   ⚠️  missing local file, skipping: ${localPath}`);
    return null;
  }

  const ext = path.extname(abs).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  if (DRY_RUN) {
    const fakeUrl = `${(process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '')}/${folder}/${rel}`;
    console.log(`   [dry-run] would upload ${localPath} -> ${fakeUrl}`);
    cache[localPath] = fakeUrl;
    return fakeUrl;
  }

  const buffer = fs.readFileSync(abs);
  const { url } = await r2.uploadBuffer({
    buffer,
    contentType,
    originalName: path.basename(rel),
    folder,
  });
  cache[localPath] = url;
  console.log(`   ✔ ${localPath} -> ${url}`);
  return url;
}

async function run() {
  if (!r2.isConfigured()) {
    console.error(
      '\n❌ R2 is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, ' +
        'R2_ACCOUNT_ID (or R2_ENDPOINT) and R2_PUBLIC_URL in server/.env first.\n'
    );
    process.exit(1);
  }

  await connectDB();
  const cache = loadManifest();

  let productChanges = 0;
  let categoryChanges = 0;

  // ── Products (image + images[]) ─────────────────────────────
  const products = await Product.find({});
  console.log(`\n📦 Products: ${products.length}`);
  for (const p of products) {
    let touched = false;

    if (p.image && !isAbsoluteUrl(p.image)) {
      const url = await migratePath(p.image, cache, 'products');
      if (url && url !== p.image) {
        p.image = url;
        touched = true;
      }
    }

    if (Array.isArray(p.images) && p.images.length) {
      const next = [];
      for (const img of p.images) {
        if (img && !isAbsoluteUrl(img)) {
          const url = await migratePath(img, cache, 'products');
          next.push(url || img);
          if (url && url !== img) touched = true;
        } else {
          next.push(img);
        }
      }
      if (touched) p.images = next;
    }

    if (touched) {
      productChanges++;
      if (!DRY_RUN) await p.save();
    }
  }

  // ── Categories (image) ──────────────────────────────────────
  const categories = await Category.find({});
  console.log(`\n🗂️  Categories: ${categories.length}`);
  for (const c of categories) {
    if (c.image && !isAbsoluteUrl(c.image)) {
      const url = await migratePath(c.image, cache, 'categories');
      if (url && url !== c.image) {
        c.image = url;
        categoryChanges++;
        if (!DRY_RUN) await c.save();
      }
    }
  }

  saveManifest(cache);

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}Done.`);
  console.log(`   Products updated:   ${productChanges}`);
  console.log(`   Categories updated: ${categoryChanges}`);
  console.log(`   Manifest:           ${MANIFEST_PATH}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(`\n❌ Migration failed: ${err.message}\n`);
  process.exit(1);
});
