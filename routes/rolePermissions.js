const express = require('express');
const { body, param, validationResult } = require('express-validator');
const RolePermission = require('../models/RolePermission');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('role');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    }
    next();
  } catch (err) {
    console.error('Admin check error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error during authorization check' });
  }
};

// Helper function to handle validation errors
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  return null;
};

// POST / - Create or update permissions for a role (upsert by roleId)
router.post(
  '/',
  [
    auth,
    isAdmin,
    body('roleId').isMongoId().withMessage('Invalid role ID'),
    body('permissions').isArray().withMessage('Permissions must be an array'),
    body('permissions.*.menuId').optional().isMongoId().withMessage('Invalid menu ID'),
    body('permissions.*.menuGroupId').optional().isMongoId().withMessage('Invalid menu group ID'),
    body('permissions.*.read').optional().isBoolean().withMessage('Read must be a boolean'),
    body('permissions.*.write').optional().isBoolean().withMessage('Write must be a boolean'),
    body('permissions.*.edit').optional().isBoolean().withMessage('Edit must be a boolean'),
    body('permissions.*.delete').optional().isBoolean().withMessage('Delete must be a boolean'),
    body('permissions.*.print').optional().isBoolean().withMessage('Print must be a boolean'),
    body('permissions.*.mail').optional().isBoolean().withMessage('Mail must be a boolean')
  ],
  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { roleId, permissions } = req.body;

    try {
      // Upsert: update if exists, create if not
      const rolePermission = await RolePermission.findOneAndUpdate(
        { roleId },
        {
          roleId,
          permissions,
          isActive: true
        },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Role permissions saved successfully',
        data: rolePermission
      });
    } catch (err) {
      console.error('Error saving role permissions:', err.message);

      if (err.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(err.errors).map(e => e.message)
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Server error while saving permissions'
      });
    }
  }
);

// GET /:roleId - Get permissions by role ID (any authenticated user can read their own role)
router.get(
  '/:roleId',
  [
    auth,
    param('roleId').isMongoId().withMessage('Invalid role ID')
  ],
  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { roleId } = req.params;

    try {
      const rolePermission = await RolePermission.findOne({ roleId })
        .populate('roleId', 'roleName')
        .populate('permissions.menuId', 'name')
        .populate('permissions.menuGroupId', 'name');

      if (!rolePermission) {
        return res.status(404).json({
          success: false,
          message: 'Role permissions not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Role permissions retrieved successfully',
        data: rolePermission
      });
    } catch (err) {
      console.error('Error fetching role permissions:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Server error while fetching permissions'
      });
    }
  }
);

module.exports = router;
