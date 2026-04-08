const mongoose = require('mongoose');

const permissionItemSchema = new mongoose.Schema({
  menuId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu'
  },
  menuGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuGroup'
  },
  read: { type: Boolean, default: false },
  write: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
  print: { type: Boolean, default: false },
  mail: { type: Boolean, default: false }
}, { _id: false });

const rolePermissionSchema = new mongoose.Schema({
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  permissions: [permissionItemSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

rolePermissionSchema.index({ roleId: 1 }, { unique: true });

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
