/**
 * Admin API namespace — mounted at /api/admin.
 *
 * Every route under here is guaranteed to be admin-only: `protect` and `admin`
 * are applied once at the router level below, so ALL methods (GET included) are
 * gated. This is intentional defense-in-depth on top of the per-route guards —
 * the admin surface is fully separated from the public/customer API.
 *
 * A non-admin (or unauthenticated) request never reaches any handler here; it
 * is rejected by `protect`/`admin` with 401/403 before routing.
 */
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../../middleware/authMiddleware');

// Hard gate for the entire admin namespace.
router.use(protect, admin);

// Resource sub-routers (each assumes the request is already admin-authorized).
router.use('/products', require('./adminProductRoutes'));
router.use('/categories', require('./adminCategoryRoutes'));
router.use('/orders', require('./adminOrderRoutes'));
router.use('/users', require('./adminUserRoutes'));
router.use('/feedbacks', require('./adminFeedbackRoutes'));
router.use('/stats', require('./adminStatsRoutes'));
router.use('/uploads', require('./adminUploadRoutes'));

module.exports = router;
