const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const r2 = require('../config/r2');

// Accept images only, in memory, capped at 8 MB.
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('Unsupported file type. Upload a JPEG, PNG, WebP, AVIF, GIF or SVG image.'));
  },
});

// @desc    Report whether R2 uploads are available (admin UI can adapt).
// @route   GET /api/uploads/status
// @access  Private/Admin
router.get('/status', protect, admin, (req, res) => {
  res.json({ enabled: r2.isConfigured() });
});

// @desc    Upload a single image to Cloudflare R2.
// @route   POST /api/uploads   (multipart/form-data, field name: "file")
// @access  Private/Admin
// @returns { url, key }
router.post('/', protect, admin, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided (expected field "file")' });
    }
    if (!r2.isConfigured()) {
      return res.status(503).json({
        message: 'Image storage is not configured. Set R2_* variables in the server .env.',
      });
    }

    try {
      const folder = /^[a-z0-9/_-]+$/i.test(req.body.folder || '') ? req.body.folder : 'products';
      const { url, key } = await r2.uploadBuffer({
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
        originalName: req.file.originalname,
        folder,
      });
      res.status(201).json({ url, key });
    } catch (e) {
      console.error('[uploads] R2 upload failed:', e.message);
      res.status(502).json({ message: 'Failed to store image. Please try again.' });
    }
  });
});

// @desc    Upload multiple images to Cloudflare R2.
// @route   POST /api/uploads/multiple   (field name: "files")
// @access  Private/Admin
// @returns { urls: [{ url, key }] }
router.post('/multiple', protect, admin, (req, res) => {
  upload.array('files', 10)(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ message: err.message || 'Upload failed' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files provided (expected field "files")' });
    }
    if (!r2.isConfigured()) {
      return res.status(503).json({
        message: 'Image storage is not configured. Set R2_* variables in the server .env.',
      });
    }

    try {
      const folder = /^[a-z0-9/_-]+$/i.test(req.body.folder || '') ? req.body.folder : 'products';
      const urls = await Promise.all(
        req.files.map((f) =>
          r2.uploadBuffer({
            buffer: f.buffer,
            contentType: f.mimetype,
            originalName: f.originalname,
            folder,
          })
        )
      );
      res.status(201).json({ urls });
    } catch (e) {
      console.error('[uploads] R2 multi-upload failed:', e.message);
      res.status(502).json({ message: 'Failed to store one or more images. Please try again.' });
    }
  });
});

// @desc    Delete an image from R2 by key or full public URL.
// @route   DELETE /api/uploads   { value }
// @access  Private/Admin
router.delete('/', protect, admin, async (req, res) => {
  const value = req.body.value || req.query.value;
  if (!value) return res.status(400).json({ message: 'No image value provided' });
  try {
    const deleted = await r2.deleteByUrlOrKey(value);
    res.json({ deleted });
  } catch (e) {
    console.error('[uploads] R2 delete failed:', e.message);
    res.status(502).json({ message: 'Failed to delete image' });
  }
});

module.exports = router;
