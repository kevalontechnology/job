const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

// Helper function to hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

// GET / - List all users (exclude password field, populate roleId with roleName)
router.get('/', [auth, requireAdmin], async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('roleId', 'roleName')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: users
    });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// POST / - Create user
router.post(
  '/',
  [
    auth,
    requireAdmin,
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('roleId')
      .optional()
      .isMongoId().withMessage('Invalid role ID')
  ],
  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { username, email, password, roleId } = req.body;

    try {
      // Check if user with email already exists
      let existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Check if user with username already exists
      existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this username already exists'
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user object
      const userData = {
        username,
        email,
        password: hashedPassword
      };

      // Add roleId if provided
      if (roleId) {
        userData.roleId = roleId;
      }

      // Create and save user
      const user = new User(userData);
      await user.save();

      // Return user without password
      const userResponse = await User.findById(user.id)
        .select('-password')
        .populate('roleId', 'roleName');

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: userResponse
      });
    } catch (err) {
      console.error('Error creating user:', err.message);

      if (err.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(err.errors).map(e => e.message)
        });
      }

      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `User with this ${field} already exists`
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Server error while creating user'
      });
    }
  }
);

// PUT /:id - Update user
router.put(
  '/:id',
  [
    auth,
    requireAdmin,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .optional()
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('roleId')
      .optional()
      .isMongoId().withMessage('Invalid role ID'),
    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be a boolean')
  ],
  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { id } = req.params;
    const { username, email, password, roleId, isActive } = req.body;

    try {
      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Build update object
      const updateData = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (roleId !== undefined) updateData.roleId = roleId;
      if (isActive !== undefined) updateData.isActive = isActive;

      // Hash password if provided
      if (password) {
        updateData.password = await hashPassword(password);
      }

      // Check for unique constraints if username or email is being updated
      if (username && username !== user.username) {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Username already exists'
          });
        }
      }

      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email already exists'
          });
        }
      }

      // Update user
      const updatedUser = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
        .select('-password')
        .populate('roleId', 'roleName');

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });
    } catch (err) {
      console.error('Error updating user:', err.message);

      if (err.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(err.errors).map(e => e.message)
        });
      }

      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `User with this ${field} already exists`
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Server error while updating user'
      });
    }
  }
);

// DELETE /:id - Delete user (cannot delete self)
router.delete(
  '/:id',
  [
    auth,
    requireAdmin,
    param('id').isMongoId().withMessage('Invalid user ID')
  ],
  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { id } = req.params;

    try {
      // Check if trying to delete self
      if (req.user.id === id) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own account'
        });
      }

      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Delete user
      await User.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully',
        data: { id }
      });
    } catch (err) {
      console.error('Error deleting user:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Server error while deleting user'
      });
    }
  }
);

module.exports = router;
