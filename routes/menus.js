const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { handleValidationErrors } = require('../middleware/validate');
const MenuGroup = require('../models/MenuGroup');
const Menu = require('../models/Menu');

const router = express.Router();

// Alias for backward compat in route arrays
const checkAdmin = requireAdmin;

// ==================== MENU GROUP ROUTES ====================

// POST /api/menus/groups - Create menu group
router.post('/groups', [
  auth,
  checkAdmin,
  body('menuGroupName')
    .trim()
    .notEmpty()
    .withMessage('Menu group name is required')
    .isLength({ max: 100 })
    .withMessage('Menu group name must not exceed 100 characters')
    .escape(),
  body('sequence')
    .isInt({ min: 0 })
    .withMessage('Sequence must be a non-negative integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isLink')
    .optional()
    .isBoolean()
    .withMessage('isLink must be a boolean'),
  body('menuUrl')
    .optional()
    .trim()
    .escape(),
  body('icon')
    .optional()
    .trim()
    .escape()
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { menuGroupName, sequence, isActive, isLink, menuUrl, icon } = req.body;

    // Check for duplicate sequence
    const existingSequence = await MenuGroup.findOne({ sequence });
    if (existingSequence) {
      return res.status(400).json({
        success: false,
        message: 'A menu group with this sequence already exists'
      });
    }

    const menuGroup = new MenuGroup({
      menuGroupName,
      sequence,
      isActive: isActive !== undefined ? isActive : true,
      isLink: isLink !== undefined ? isLink : false,
      menuUrl: menuUrl || '#',
      icon: icon || ''
    });

    await menuGroup.save();

    res.status(201).json({
      success: true,
      message: 'Menu group created successfully',
      data: menuGroup
    });
  } catch (err) {
    console.error('Create menu group error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while creating menu group'
    });
  }
});

// GET /api/menus/groups - List all menu groups sorted by sequence
router.get('/groups', [auth, checkAdmin], async (req, res) => {
  try {
    const menuGroups = await MenuGroup.find().sort({ sequence: 1 });

    res.json({
      success: true,
      message: 'Menu groups retrieved successfully',
      data: menuGroups
    });
  } catch (err) {
    console.error('Get menu groups error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving menu groups'
    });
  }
});

// PUT /api/menus/groups/:id - Update menu group
router.put('/groups/:id', [
  auth,
  checkAdmin,
  param('id')
    .isMongoId()
    .withMessage('Invalid menu group ID'),
  body('menuGroupName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Menu group name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Menu group name must not exceed 100 characters')
    .escape(),
  body('sequence')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sequence must be a non-negative integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isLink')
    .optional()
    .isBoolean()
    .withMessage('isLink must be a boolean'),
  body('menuUrl')
    .optional()
    .trim()
    .escape(),
  body('icon')
    .optional()
    .trim()
    .escape()
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if menu group exists
    const menuGroup = await MenuGroup.findById(id);
    if (!menuGroup) {
      return res.status(404).json({
        success: false,
        message: 'Menu group not found'
      });
    }

    // Check for duplicate sequence if sequence is being updated
    if (updates.sequence !== undefined && updates.sequence !== menuGroup.sequence) {
      const existingSequence = await MenuGroup.findOne({
        sequence: updates.sequence,
        _id: { $ne: id }
      });
      if (existingSequence) {
        return res.status(400).json({
          success: false,
          message: 'A menu group with this sequence already exists'
        });
      }
    }

    const updatedMenuGroup = await MenuGroup.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Menu group updated successfully',
      data: updatedMenuGroup
    });
  } catch (err) {
    console.error('Update menu group error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while updating menu group'
    });
  }
});

// DELETE /api/menus/groups/:id - Delete menu group
router.delete('/groups/:id', [
  auth,
  checkAdmin,
  param('id')
    .isMongoId()
    .withMessage('Invalid menu group ID')
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { id } = req.params;

    // Check if menu group exists
    const menuGroup = await MenuGroup.findById(id);
    if (!menuGroup) {
      return res.status(404).json({
        success: false,
        message: 'Menu group not found'
      });
    }

    // Check for menu references
    const menusUsingGroup = await Menu.countDocuments({ menuGroup: id });
    if (menusUsingGroup > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete menu group. ${menusUsingGroup} menu(s) are using this group.`
      });
    }

    await MenuGroup.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Menu group deleted successfully',
      data: { id }
    });
  } catch (err) {
    console.error('Delete menu group error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting menu group'
    });
  }
});

// ==================== MENU ROUTES ====================

// POST /api/menus - Create menu item
router.post('/', [
  auth,
  checkAdmin,
  body('menuName')
    .trim()
    .notEmpty()
    .withMessage('Menu name is required')
    .isLength({ max: 100 })
    .withMessage('Menu name must not exceed 100 characters')
    .escape(),
  body('menuGroup')
    .isMongoId()
    .withMessage('Valid menu group ID is required'),
  body('menuUrl')
    .trim()
    .notEmpty()
    .withMessage('Menu URL is required')
    .escape(),
  body('sequence')
    .isInt({ min: 0 })
    .withMessage('Sequence must be a non-negative integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isParent')
    .optional()
    .isBoolean()
    .withMessage('isParent must be a boolean'),
  body('parentMenu')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage('Invalid parent menu ID'),
  body('icon')
    .optional()
    .trim()
    .escape()
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { menuName, menuGroup, menuUrl, sequence, isActive, isParent, parentMenu, icon } = req.body;

    // Verify menu group exists
    const groupExists = await MenuGroup.findById(menuGroup);
    if (!groupExists) {
      return res.status(404).json({
        success: false,
        message: 'Menu group not found'
      });
    }

    // Verify parent menu exists if provided
    if (parentMenu && parentMenu !== null && parentMenu !== '') {
      const parentExists = await Menu.findById(parentMenu);
      if (!parentExists) {
        return res.status(404).json({
          success: false,
          message: 'Parent menu not found'
        });
      }
    }

    const menu = new Menu({
      menuName,
      menuGroup,
      menuUrl,
      sequence,
      isActive: isActive !== undefined ? isActive : true,
      isParent: isParent !== undefined ? isParent : false,
      parentMenu: parentMenu && parentMenu !== '' ? parentMenu : null,
      icon: icon || ''
    });

    await menu.save();

    const populatedMenu = await Menu.findById(menu._id)
      .populate('menuGroup', 'menuGroupName')
      .populate('parentMenu', 'menuName');

    res.status(201).json({
      success: true,
      message: 'Menu created successfully',
      data: populatedMenu
    });
  } catch (err) {
    console.error('Create menu error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while creating menu'
    });
  }
});

// GET /api/menus - List all menus
router.get('/', [auth, checkAdmin], async (req, res) => {
  try {
    const menus = await Menu.find()
      .populate('menuGroup', 'menuGroupName')
      .populate('parentMenu', 'menuName')
      .sort({ menuGroup: 1, sequence: 1 });

    res.json({
      success: true,
      message: 'Menus retrieved successfully',
      data: menus
    });
  } catch (err) {
    console.error('Get menus error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving menus'
    });
  }
});

// GET /api/menus/by-groups - Get menus grouped hierarchically
router.get('/by-groups', auth, async (req, res) => {
  try {
    // Get all menu groups sorted by sequence
    const menuGroups = await MenuGroup.find().sort({ sequence: 1 }).lean();

    // Get all menus sorted by sequence
    const allMenus = await Menu.find()
      .populate('menuGroup', 'menuGroupName')
      .sort({ sequence: 1 })
      .lean();

    // Build hierarchical structure
    const result = menuGroups.map(group => {
      // Get all menus for this group
      const groupMenus = allMenus.filter(
        menu => menu.menuGroup._id.toString() === group._id.toString()
      );

      // Separate parent and child menus
      const parentMenus = groupMenus.filter(menu => !menu.parentMenu);
      const childMenus = groupMenus.filter(menu => menu.parentMenu);

      // Build parent-child hierarchy
      const menusWithChildren = parentMenus.map(parentMenu => {
        const children = childMenus
          .filter(child => child.parentMenu.toString() === parentMenu._id.toString())
          .sort((a, b) => a.sequence - b.sequence);

        return {
          ...parentMenu,
          children: children.length > 0 ? children : []
        };
      });

      return {
        menuGroup: group,
        menus: menusWithChildren
      };
    });

    res.json({
      success: true,
      message: 'Hierarchical menu structure retrieved successfully',
      data: result
    });
  } catch (err) {
    console.error('Get menus by groups error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving hierarchical menu structure'
    });
  }
});

// PUT /api/menus/:id - Update menu
router.put('/:id', [
  auth,
  checkAdmin,
  param('id')
    .isMongoId()
    .withMessage('Invalid menu ID'),
  body('menuName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Menu name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Menu name must not exceed 100 characters')
    .escape(),
  body('menuGroup')
    .optional()
    .isMongoId()
    .withMessage('Invalid menu group ID'),
  body('menuUrl')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Menu URL cannot be empty')
    .escape(),
  body('sequence')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sequence must be a non-negative integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isParent')
    .optional()
    .isBoolean()
    .withMessage('isParent must be a boolean'),
  body('parentMenu')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage('Invalid parent menu ID'),
  body('icon')
    .optional()
    .trim()
    .escape()
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if menu exists
    const menu = await Menu.findById(id);
    if (!menu) {
      return res.status(404).json({
        success: false,
        message: 'Menu not found'
      });
    }

    // Verify menu group exists if being updated
    if (updates.menuGroup) {
      const groupExists = await MenuGroup.findById(updates.menuGroup);
      if (!groupExists) {
        return res.status(404).json({
          success: false,
          message: 'Menu group not found'
        });
      }
    }

    // Verify parent menu exists if being updated
    if (updates.parentMenu && updates.parentMenu !== null && updates.parentMenu !== '') {
      // Prevent self-reference
      if (updates.parentMenu === id) {
        return res.status(400).json({
          success: false,
          message: 'Menu cannot be its own parent'
        });
      }

      const parentExists = await Menu.findById(updates.parentMenu);
      if (!parentExists) {
        return res.status(404).json({
          success: false,
          message: 'Parent menu not found'
        });
      }

      // Prevent circular references
      let currentParent = parentExists;
      while (currentParent && currentParent.parentMenu) {
        if (currentParent.parentMenu.toString() === id) {
          return res.status(400).json({
            success: false,
            message: 'Circular parent reference detected'
          });
        }
        currentParent = await Menu.findById(currentParent.parentMenu);
      }
    }

    // Handle null or empty string for parentMenu
    if (updates.parentMenu === '' || updates.parentMenu === null) {
      updates.parentMenu = null;
    }

    const updatedMenu = await Menu.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('menuGroup', 'menuGroupName')
      .populate('parentMenu', 'menuName');

    res.json({
      success: true,
      message: 'Menu updated successfully',
      data: updatedMenu
    });
  } catch (err) {
    console.error('Update menu error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while updating menu'
    });
  }
});

// DELETE /api/menus/:id - Delete menu
router.delete('/:id', [
  auth,
  checkAdmin,
  param('id')
    .isMongoId()
    .withMessage('Invalid menu ID')
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  try {
    const { id } = req.params;

    // Check if menu exists
    const menu = await Menu.findById(id);
    if (!menu) {
      return res.status(404).json({
        success: false,
        message: 'Menu not found'
      });
    }

    // Check for child menu references
    const childMenus = await Menu.countDocuments({ parentMenu: id });
    if (childMenus > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete menu. ${childMenus} child menu(s) are referencing this menu.`
      });
    }

    await Menu.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Menu deleted successfully',
      data: { id }
    });
  } catch (err) {
    console.error('Delete menu error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting menu'
    });
  }
});

module.exports = router;
