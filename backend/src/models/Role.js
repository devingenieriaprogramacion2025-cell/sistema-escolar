const mongoose = require('mongoose');
const { ALL_ROLES, getRolePermissions } = require('../constants/roles');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ALL_ROLES
    },
    description: {
      type: String,
      default: ''
    },
    permissions: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    }
  },
  { timestamps: true }
);

roleSchema.pre('validate', function () {
  if (!this.permissions || this.permissions.length === 0) {
    this.permissions = getRolePermissions(this.name);
  }
});

module.exports = mongoose.model('Role', roleSchema);
