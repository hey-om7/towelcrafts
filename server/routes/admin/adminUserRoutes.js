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
const { STAFF_ROLES, ROLES } = require('../../models/User');

// Throttle OTP requests to blunt email-spam / enumeration.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many approval requests. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Fixed approver address that must confirm any staff-role promotion. */
function approverEmail() {
  return process.env.ADMIN_APPROVER_EMAIL || 'om.ambarkar@gmail.com';
}

/** Normalize an arbitrary roles input into a clean, valid, deduped array. */
function normalizeRoles(input) {
  const arr = Array.isArray(input) ? input : [];
  const cleaned = arr.filter((r) => ROLES.includes(r));
  if (!cleaned.includes('user')) cleaned.unshift('user');
  return [...new Set(cleaned)];
}

/**
 * Given the current user and a requested `roles` array, return the staff roles
 * that would be NEWLY GRANTED (i.e. added). Granting any staff role requires
 * OTP approval; removing roles or editing other fields does not.
 * @returns {string[]} staff roles being added (empty if none)
 */
function escalatedRoles(currentUser, requestedRoles) {
  if (!Array.isArray(requestedRoles)) return [];
  const current = new Set(currentUser.roles || []);
  return requestedRoles.filter((r) => STAFF_ROLES.includes(r) && !current.has(r));
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

// @desc    Modify a user (roles / access / details)
// @route   PUT /api/admin/users/:id
// @note    GRANTING a staff role (admin/manager) is NOT allowed here — it must
//          go through the email-OTP approval flow. Removing staff roles,
//          deactivation, and profile edits pass through.
router.put('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, phone, roles, isActive } = req.body;

    if (roles !== undefined) {
      const requested = normalizeRoles(roles);
      const added = escalatedRoles(user, requested);
      if (added.length > 0) {
        return res.status(403).json({
          message: 'Granting a staff role requires email approval. Use the approval flow.',
          code: 'OTP_REQUIRED',
          roles: added,
        });
      }
      // No staff role added — safe to apply (this covers demotions and re-ordering).
      user.roles = requested;
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = !!isActive;

    const updated = await user.save({ validateBeforeSave: false });
    const obj = updated.toObject();
    delete obj.password;
    res.json(obj);
  } catch (error) {
    next(error);
  }
});

// @desc    Request an OTP (emailed to the approver) to grant a staff role
// @route   POST /api/admin/users/:id/role-otp/request   { role }
router.post('/:id/role-otp/request', otpRequestLimiter, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const role = req.body.role;
    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ message: 'A staff role (admin or manager) is required' });
    }

    if ((user.roles || []).includes(role)) {
      return res.status(400).json({ message: 'This user already holds that role.' });
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

// @desc    Verify the OTP and grant the staff role (adds it to the user's roles)
// @route   POST /api/admin/users/:id/role-otp/verify   { role, code }
router.post('/:id/role-otp/verify', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { role, code } = req.body;
    if (!STAFF_ROLES.includes(role) || !code) {
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

    // Grant the role by ADDING it (the pre-save hook dedupes + keeps 'user').
    user.roles = [...new Set([...(user.roles || []), role])];
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
