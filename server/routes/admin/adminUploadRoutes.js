/**
 * Admin image uploads — mounted at /api/admin/uploads.
 *
 * The upload router is entirely admin-only, so it is reused as-is. The parent
 * admin router already applies `protect, admin`; the per-route guards inside
 * are a harmless (and intentional) second layer.
 */
module.exports = require('../uploadRoutes');
