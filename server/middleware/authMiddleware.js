const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - verify JWT token
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret123'
      );

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!req.user.isActive) {
        return res.status(403).json({ message: 'Account has been deactivated' });
      }

      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token invalid' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

const { STAFF_ROLES } = require('../models/User');

/**
 * Admin middleware — allows users holding any elevated (staff) role.
 * Staff roles are 'admin' and 'manager'; both grant admin-panel access.
 */
const admin = (req, res, next) => {
  const roles = (req.user && req.user.roles) || [];
  const isStaff = Array.isArray(roles) && roles.some((r) => STAFF_ROLES.includes(r));
  if (isStaff) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized, admin access required' });
  }
};

/**
 * Factory: require a specific role (e.g. requireRole('manager')).
 * Use for endpoints that only one staff role should reach.
 */
const requireRole = (role) => (req, res, next) => {
  const roles = (req.user && req.user.roles) || [];
  if (Array.isArray(roles) && roles.includes(role)) {
    next();
  } else {
    res.status(403).json({ message: `Not authorized, ${role} access required` });
  }
};

module.exports = { protect, admin, requireRole };
