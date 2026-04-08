const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  roleName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

roleSchema.index({ roleName: 1 });

module.exports = mongoose.model('Role', roleSchema);
