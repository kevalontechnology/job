const mongoose = require('mongoose');

const menuGroupSchema = new mongoose.Schema({
  menuGroupName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  sequence: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isLink: {
    type: Boolean,
    default: false
  },
  menuUrl: {
    type: String,
    default: '#',
    trim: true
  },
  icon: {
    type: String,
    default: '',
    trim: true
  }
}, { timestamps: true });

menuGroupSchema.index({ sequence: 1 });

module.exports = mongoose.model('MenuGroup', menuGroupSchema);
