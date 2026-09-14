const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Address = require('../models/Address');
const AdminOtp = require('../models/AdminOtp');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { protect, admin } = require('../middleware/authMiddleware');
const { sendMail } = require('../utils/mailer');
const { adminRoleOtpEmail } = require('../utils/emailTemplates');

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const PRIVILEGED_ROLES = ['admin', 'superadmin'];

// Throttle OTP requests to blunt email-spam / enumeration: max 5 requests per
// 15 minutes per IP. Applied only to the request endpoint below.
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
 * who does not already hold them. Only these transitions require OTP approval;
 * demotions and benign edits (name/phone/isActive) do not.
 *
 * @returns {string|null} the privileged role being granted, or null if none
 */
function escalationRole(currentUser, body) {
  const alreadyPrivileged =
    currentUser.role === 'admin' ||
    currentUser.role === 'superadmin' ||
    currentUser.isAdmin === true;

  // Role change to a privileged role.
  if (body.role !== undefined && PRIVILEGED_ROLES.includes(body.role)) {
    // Promoting to a privileged role the user doesn't already hold, OR
    // changing between privileged roles (e.g. admin -> superadmin).
    if (!alreadyPrivileged || body.role !== currentUser.role) return body.role;
  }

  // Legacy isAdmin flag flipped on for a non-privileged user.
  if (body.isAdmin === true && !alreadyPrivileged) return 'admin';

  return null;
}

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

// @desc    Authenticate with Google & get token
// @route   POST /api/users/google
// @access  Public
router.post('/google', async (req, res, next) => {
  try {
    if (!googleClient) {
      return res.status(503).json({ message: 'Google sign-in is not configured on the server' });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ message: 'Invalid Google credential' });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Find existing user by googleId or email, otherwise create one
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Link Google account to existing local account if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
        if (user.authProvider === 'local') {
          // Keep local auth but allow google login too
        }
      }
      if (picture && !user.avatar) user.avatar = picture;
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });
    } else {
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        authProvider: 'google',
        googleId,
        avatar: picture || '',
        lastLogin: new Date(),
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Google auth error:', error.message);
    return res.status(401).json({ message: 'Google authentication failed' });
  }
});

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Please provide a valid email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated' });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, phone, addressLine, city, state, pincode, country } = req.body;

    if (!name || !email || !password || typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
      return res.status(400).json({ message: 'Please provide a valid name, email, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
    });

    // Create address if provided
    if (addressLine && city && pincode) {
      await Address.create({
        user: user._id,
        addressLine,
        city,
        state,
        pincode,
        country: country || 'India',
        isDefault: true,
      });
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;
    user.avatar = req.body.avatar || user.avatar;

    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = req.body.email;
    }

    if (req.body.password) {
      if (req.body.password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      isAdmin: updatedUser.isAdmin,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      token: generateToken(updatedUser._id),
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
router.get('/', protect, admin, async (req, res, next) => {
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

    res.json({
      users,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get the logged-in user's addresses
// @route   GET /api/users/address
// @access  Private
router.get('/address', protect, async (req, res, next) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1 });

    if (addresses.length === 0) {
      // Return empty for backward compatibility
      return res.status(404).json({ message: 'No address found for this user' });
    }

    // Return first (default) address for backward compatibility
    res.json(addresses[0]);
  } catch (error) {
    next(error);
  }
});

// @desc    Get all addresses for logged-in user
// @route   GET /api/users/addresses
// @access  Private
router.get('/addresses', protect, async (req, res, next) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1 });
    res.json(addresses);
  } catch (error) {
    next(error);
  }
});

// @desc    Add a new address
// @route   POST /api/users/address
// @access  Private
router.post('/address', protect, async (req, res, next) => {
  try {
    const { label, fullName, phone, addressLine, addressLine2, landmark, city, state, pincode, country, isDefault } = req.body;

    if (!addressLine || !city || !pincode) {
      return res.status(400).json({ message: 'Address line, city, and pincode are required' });
    }

    const address = await Address.create({
      user: req.user._id,
      label,
      fullName,
      phone,
      addressLine,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      country: country || 'India',
      isDefault: isDefault || false,
    });

    res.status(201).json(address);
  } catch (error) {
    next(error);
  }
});

// @desc    Update an existing address
// @route   PUT /api/users/address/:id
// @access  Private
router.put('/address/:id', protect, async (req, res, next) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user._id });

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

// @desc    Set an address as the default
// @route   PUT /api/users/address/:id/default
// @access  Private
router.put('/address/:id/default', protect, async (req, res, next) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user._id });

    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    address.isDefault = true;
    await address.save(); // pre-save hook unsets isDefault on the others

    const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1 });
    res.json(addresses);
  } catch (error) {
    next(error);
  }
});

// @desc    Delete an address
// @route   DELETE /api/users/address/:id
// @access  Private
router.delete('/address/:id', protect, async (req, res, next) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user._id });

    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const wasDefault = address.isDefault;
    await address.deleteOne();

    // Promote another address to default so the user always has one.
    if (wasDefault) {
      const fallback = await Address.findOne({ user: req.user._id }).sort({ createdAt: 1 });
      if (fallback) {
        fallback.isDefault = true;
        await fallback.save();
      }
    }

    res.json({ message: 'Address removed' });
  } catch (error) {
    next(error);
  }
});

// @desc    Get a single user with orders & addresses (admin)
// @route   GET /api/users/:id
// @access  Private/Admin
router.get('/:id', protect, admin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const Order = require('../models/Order');
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

// @desc    Modify a user (role / access / details) — admin
// @route   PUT /api/users/:id
// @access  Private/Admin
// @note    Granting admin privileges is NOT allowed here — it must go through
//          the email-OTP approval flow (POST /:id/role-otp/request + /verify).
router.put('/:id', protect, admin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, phone, role, isAdmin, isActive } = req.body;

    // Block privilege escalation on the direct edit path — it requires OTP
    // approval. Demotions, deactivation, and profile edits pass through.
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
      // Keep the legacy isAdmin flag in sync with the role.
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
// @route   POST /api/users/:id/role-otp/request   { role }
// @access  Private/Admin
router.post('/:id/role-otp/request', protect, admin, otpRequestLimiter, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const role = req.body.role;
    if (!PRIVILEGED_ROLES.includes(role)) {
      return res.status(400).json({ message: 'A privileged role (admin or superadmin) is required' });
    }

    // Guard: only proceed if this is a genuine escalation.
    if (!escalationRole(user, { role })) {
      return res.status(400).json({ message: 'This user already holds that access.' });
    }

    // Invalidate any prior pending OTPs for this user so only the latest works.
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

    // Fail loudly if the email did not actually go out — otherwise the admin
    // would be waiting for a code that will never arrive.
    if (!result.sent) {
      // Clean up the unusable OTP so a retry starts fresh.
      await AdminOtp.deleteMany({ targetUser: user._id, consumed: false });
      const reason = result.skipped
        ? 'Email is not configured on the server.'
        : 'Could not send the approval email. Please try again.';
      return res.status(502).json({ message: reason });
    }

    // Never reveal the approver address or the code to the caller.
    res.status(202).json({
      message: 'An approval code has been emailed to the authorized approver.',
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Verify the OTP and commit the admin promotion
// @route   POST /api/users/:id/role-otp/verify   { role, code }
// @access  Private/Admin
router.post('/:id/role-otp/verify', protect, admin, async (req, res, next) => {
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

    // Correct code — commit the promotion and consume the OTP.
    otp.consumed = true;
    await otp.save();

    user.role = role;
    user.isAdmin = true; // both privileged roles imply admin access
    const updated = await user.save({ validateBeforeSave: false });
    const obj = updated.toObject();
    delete obj.password;

    res.json(obj);
  } catch (error) {
    next(error);
  }
});

// @desc    Update any user's address (admin)
// @route   PUT /api/users/:userId/address/:addressId
// @access  Private/Admin
router.put('/:userId/address/:addressId', protect, admin, async (req, res, next) => {
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

// @desc    Delete any user's address (admin)
// @route   DELETE /api/users/:userId/address/:addressId
// @access  Private/Admin
router.delete('/:userId/address/:addressId', protect, admin, async (req, res, next) => {
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

// @desc    Delete user (admin)
// @route   DELETE /api/users/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Soft delete - deactivate instead of removing
    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
