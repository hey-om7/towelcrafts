const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Address = require('../models/Address');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { protect, admin } = require('../middleware/authMiddleware');

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
router.put('/:id', protect, admin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, phone, role, isAdmin, isActive } = req.body;

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
