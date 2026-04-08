const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Role = require('../models/Role');
const User = require('../models/User');
const RolePermission = require('../models/RolePermission');
const auth = require('../middleware/auth');

// Middleware to check admin role
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        data: null
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verifying admin privileges',
      data: null
    });
  }
};

// Input sanitization helper
const sanitizeInput = (value) => {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/[<>]/g, '');
};

// Validation rules for role creation/update
const roleValidationRules = [
  body('roleName')
    .notEmpty()
    .withMessage('Role name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Role name must be between 2 and 50 characters')
    .customSanitizer(sanitizeInput),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

// Validation error handler
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      data: errors.array()
    });
  }
  return null;
};

// POST / - Create new role
router.post('/', auth, requireAdmin, roleValidationRules, async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { roleName, isActive } = req.body;

    // Check if role already exists
    const existingRole = await Role.findOne({ roleName: sanitizeInput(roleName) });
    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: 'Role with this name already exists',
        data: null
      });
    }

    // Create new role
    const role = new Role({
      roleName: sanitizeInput(roleName),
      isActive: isActive !== undefined ? isActive : true
    });

    await role.save();

    return res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: role
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        data: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Role with this name already exists',
        data: null
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error creating role',
      data: null
    });
  }
});

// GET / - List all roles
router.get('/', auth, requireAdmin, async (req, res) => {
  try {
    const roles = await Role.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Roles retrieved successfully',
      data: roles
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving roles',
      data: null
    });
  }
});

// GET /:id - Get role by ID
router.get('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format',
        data: null
      });
    }

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Role retrieved successfully',
      data: role
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID',
        data: null
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error retrieving role',
      data: null
    });
  }
});

// PUT /:id - Update role
router.put('/:id', auth, requireAdmin, roleValidationRules, async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  try {
    const { id } = req.params;
    const { roleName, isActive } = req.body;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format',
        data: null
      });
    }

    // Check if role exists
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
        data: null
      });
    }

    // Check if new role name conflicts with existing role
    const sanitizedRoleName = sanitizeInput(roleName);
    if (sanitizedRoleName !== role.roleName) {
      const existingRole = await Role.findOne({ roleName: sanitizedRoleName });
      if (existingRole) {
        return res.status(409).json({
          success: false,
          message: 'Role with this name already exists',
          data: null
        });
      }
    }

    // Update role
    role.roleName = sanitizedRoleName;
    if (isActive !== undefined) {
      role.isActive = isActive;
    }

    await role.save();

    return res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: role
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        data: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID',
        data: null
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Role with this name already exists',
        data: null
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error updating role',
      data: null
    });
  }
});

// DELETE /:id - Delete role
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format',
        data: null
      });
    }

    // Check if role exists
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
        data: null
      });
    }

    // Check if role is referenced in RolePermission collection
    const rolePermissionCount = await RolePermission.countDocuments({ roleId: id });
    if (rolePermissionCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete role. It is referenced in RolePermission records.',
        data: { referencedIn: 'RolePermission', count: rolePermissionCount }
      });
    }

    // Check if role is referenced in User collection
    const userCount = await User.countDocuments({ roleId: id });
    if (userCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete role. It is assigned to users.',
        data: { referencedIn: 'User', count: userCount }
      });
    }

    // Delete role
    await Role.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Role deleted successfully',
      data: null
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID',
        data: null
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error deleting role',
      data: null
    });
  }
});

module.exports = router;
