const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

// Stricter rate limiter for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  message: { success: false, message: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: sign JWT as a promise (no unhandled throw in callback)
const signToken = (payload) => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h', algorithm: 'HS256' },
      (err, token) => (err ? reject(err) : resolve(token))
    );
  });
};

// Register
router.post('/register', authLimiter, [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { username, email, password } = req.body;

  try {
    // Check both email and username uniqueness
    const existingUser = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(400).json({ success: false, message: `User with this ${field} already exists` });
    }

    const user = new User({ username, email, password });
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const token = await signToken({ user: { id: user.id } });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        roleId: null,
        roleName: null
      }
    });
  } catch (err) {
    console.error('Register error:', err.message);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login
router.post('/login', authLimiter, [
  body('email').notEmpty().withMessage('Email or username is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, password } = req.body;

  try {
    // Support login by email or username
    const user = await User.findOne({
      $or: [{ email }, { username: email }]
    }).populate('roleId');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if user is active
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = await signToken({ user: { id: user.id } });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        roleId: user.roleId ? user.roleId._id || user.roleId : null,
        roleName: user.roleId ? user.roleId.roleName || null : null
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate('roleId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Get me error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Forgot Password — generates a 6-digit reset code
router.post('/forgot-password', authLimiter, [
  body('email').trim().notEmpty().withMessage('Email is required'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email }, { username: email }]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email/username' });
    }

    // Generate 6-digit code
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const hashedCode = await bcrypt.hash(resetCode, 10);

    // Store hashed code with 15-minute expiry
    user.resetCode = hashedCode;
    user.resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // In production, send this code via email (nodemailer/SendGrid)
    // For now, log it server-side
    console.log(`[RESET CODE] User: ${user.email} | Code: ${resetCode}`);

    res.json({
      success: true,
      message: 'Reset code generated. Check server console for the code.',
      // Include code in response for development only
      ...(process.env.NODE_ENV !== 'production' && { resetCode })
    });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reset Password — verifies code and sets new password
router.post('/reset-password', authLimiter, [
  body('email').trim().notEmpty().withMessage('Email is required'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Reset code must be 6 digits'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, code, newPassword } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email }, { username: email }]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email/username' });
    }

    // Check if reset code exists and hasn't expired
    if (!user.resetCode || !user.resetCodeExpiry) {
      return res.status(400).json({ success: false, message: 'No reset code requested. Please request a new one.' });
    }

    if (new Date() > user.resetCodeExpiry) {
      // Clear expired code
      user.resetCode = null;
      user.resetCodeExpiry = null;
      await user.save();
      return res.status(400).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
    }

    // Verify code
    const isCodeValid = await bcrypt.compare(code, user.resetCode);
    if (!isCodeValid) {
      return res.status(400).json({ success: false, message: 'Invalid reset code' });
    }

    // Set new password and clear reset fields
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetCode = null;
    user.resetCodeExpiry = null;
    await user.save();

    res.json({ success: true, message: 'Password reset successful. You can now login with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
