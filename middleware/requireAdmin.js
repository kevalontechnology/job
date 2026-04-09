const User = require('../models/User');

/**
 * Middleware: Requires authenticated user to have admin role.
 * Must be used AFTER the auth middleware.
 */
module.exports = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('role').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    }
    next();
  } catch (err) {
    console.error('Admin check error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error during authorization' });
  }
};
