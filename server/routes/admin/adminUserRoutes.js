/**
 * Admin user management — mounted at /api/admin/users.
 * Admin authorization is enforced by the parent admin router.
 *
 * Includes the email-OTP approval flow for promoting a user to a privileged
 * role: PUT /:id blocks escalation, and the promotion can only be committed
 * through /:id/role-otp/request + /:id/role-otp/verify.
 */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const User = require('../../models/User');
const Address = require('../../models/Address');
const AdminOtp = require('../../models/AdminOtp');
const Order = require('../../models/Order');
const { sendMail } = require('../../utils/mailer');
const { adminRoleOtpEmail } = require('../../utils/emailTemplates');

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const PRIVILEGED_ROLES = ['admin', 'superadmin'];

// Throttle OTP requests to blunt email-spam / enumeration.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many approval requests. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Fixed approver address that must confirm any admin promotion. */
function approverEmail() {
  return process.env.ADMIN_APPROVER_EMAIL || 'om.ambarkar@gmail.com';
}

/**
 * Determine whether a requested change would GRANT admin privileges to a user
 * who does not already hold them. Only these transitions require OTP approval.
 * @returns {string|null} the privileged role being granted, or null if none
 */
function escalationRole(currentUser, body) {
  const alreadyPrivileged =
    currentUser.role === 'admin' ||
    currentUser.role === 'superadmin' ||
    currentUser.isAdmin === true;

  if (body.role !== undefined && PRIVILEGED_ROLES.includes(body.role)) {
    if (!alreadyPrivileged || body.role !== currentUser.role) return body.role;
  }
  if (body.isAdmin === true && !alreadyPrivileged) return 'admin';
  return null;
}

// @desc    Get all users
// @route   GET /api/admin/users
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ users, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    next(error);
  }
});

// @desc    Get a single user with orders & addresses
// @route   GET /api/admin/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [addresses, orders] = await Promise.all([
      Address.find({ user: user._id }).sort({ isDefault: -1 }),
      Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(50),
    ]);

    const revenue = orders
      .filter((o) => o.orderStatus !== 'cancelled')
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    res.json({
      user,
      addresses,
      orders,
      stats: { orderCount: orders.length, revenue },
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Modify a user (role / access / details)
// @route   PUT /api/admin/users/:id
// @note    Granting admin privileges is NOT allowed here — it must go through
//          the email-OTP approval flow (/:id/role-otp/request + /verify).
router.put('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, phone, role, isAdmin, isActive } = req.body;

    if (escalationRole(user, req.body)) {
      return res.status(403).json({
        message: 'Granting admin access requires email approval. Use the approval flow.',
        code: 'OTP_REQUIRED',
      });
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined && ['customer', 'admin', 'superadmin'].includes(role)) {
      user.role = role;
      user.isAdmin = role === 'admin' || role === 'superadmin';
    }
    if (isAdmin !== undefined) user.isAdmin = !!isAdmin;
    if (isActive !== undefined) user.isActive = !!isActive;

    const updated = await user.save({ validateBeforeSave: false });
    const obj = updated.toObject();
    delete obj.password;
    res.json(obj);
  } catch (error) {
    next(error);
  }
});

// @desc    Request an OTP (emailed to the approver) to promote a user to admin
// @route   POST /api/admin/users/:id/role-otp/request   { role }
router.post('/:id/role-otp/request', otpRequestLimiter, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const role = req.body.role;
    if (!PRIVILEGED_ROLES.includes(role)) {
      return res.status(400).json({ message: 'A privileged role (admin or superadmin) is required' });
    }

    if (!escalationRole(user, { role })) {
      return res.status(400).json({ message: 'This user already holds that access.' });
    }

    await AdminOtp.deleteMany({ targetUser: user._id, consumed: false });

    const code = AdminOtp.generateCode(6);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await AdminOtp.create({
      targetUser: user._id,
      requestedRole: role,
      codeHash: AdminOtp.hashCode(code),
      requestedBy: req.user._id,
      expiresAt,
    });

    const { subject, html, text } = adminRoleOtpEmail({
      code,
      targetName: user.name,
      targetEmail: user.email,
      requestedRole: role,
      requestedByName: req.user.name,
      expiresMinutes: OTP_TTL_MINUTES,
    });

    const result = await sendMail({ to: approverEmail(), subject, html, text });

    if (!result.sent) {
      await AdminOtp.deleteMany({ targetUser: user._id, consumed: false });
      const reason = result.skipped
        ? 'Email is not configured on the server.'
        : 'Could not send the approval email. Please try again.';
      return res.status(502).json({ message: reason });
    }

    res.status(202).json({
      message: 'An approval code has been emailed to the authorized approver.',
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Verify the OTP and commit the admin promotion
// @route   POST /api/admin/users/:id/role-otp/verify   { role, code }
router.post('/:id/role-otp/verify', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { role, code } = req.body;
    if (!PRIVILEGED_ROLES.includes(role) || !code) {
      return res.status(400).json({ message: 'Role and code are required' });
    }

    const otp = await AdminOtp.findOne({
      targetUser: user._id,
      requestedRole: role,
      consumed: false,
    }).sort({ createdAt: -1 });

    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'No valid code found. Request a new one.', code: 'OTP_EXPIRED' });
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await otp.deleteOne();
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.', code: 'OTP_LOCKED' });
    }

    const matches = otp.codeHash === AdminOtp.hashCode(String(code).trim());
    if (!matches) {
      otp.attempts += 1;
      await otp.save();
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - otp.attempts);
      return res.status(400).json({ message: `Incorrect code. ${remaining} attempt(s) left.`, code: 'OTP_INVALID' });
    }

    otp.consumed = true;
    await otp.save();

    user.role = role;
    user.isAdmin = true;
    const updated = await user.save({ validateBeforeSave: false });
    const obj = updated.toObject();
    delete obj.password;

    res.json(obj);
  } catch (error) {
    next(error);
  }
});

// @desc    Update any user's address
// @route   PUT /api/admin/users/:userId/address/:addressId
router.put('/:userId/address/:addressId', async (req, res, next) => {
  try {
    const address = await Address.findOne({ _id: req.params.addressId, user: req.params.userId });
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const fields = [
      'label', 'fullName', 'phone', 'addressLine', 'addressLine2',
      'landmark', 'city', 'state', 'pincode', 'country', 'isDefault',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) address[f] = req.body[f];
    });

    const updated = await address.save();
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// @desc    Delete any user's address
// @route   DELETE /api/admin/users/:userId/address/:addressId
router.delete('/:userId/address/:addressId', async (req, res, next) => {
  try {
    const address = await Address.findOne({ _id: req.params.addressId, user: req.params.userId });
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }
    await address.deleteOne();
    res.json({ message: 'Address removed' });
  } catch (error) {
    next(error);
  }
});

// @desc    Deactivate (soft-delete) a user
// @route   DELETE /api/admin/users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
