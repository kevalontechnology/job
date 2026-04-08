const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  menuName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  menuGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuGroup',
    required: true
  },
  menuUrl: {
    type: String,
    required: true,
    trim: true
  },
  sequence: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isParent: {
    type: Boolean,
    default: false
  },
  parentMenu: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu',
    default: null
  },
  icon: {
    type: String,
    default: '',
    trim: true
  }
}, { timestamps: true });

menuSchema.index({ menuGroup: 1, sequence: 1 });
menuSchema.index({ parentMenu: 1 });

module.exports = mongoose.model('Menu', menuSchema);
