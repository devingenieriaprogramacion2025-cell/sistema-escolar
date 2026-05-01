const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    area: {
      type: String,
      required: true,
      default: 'General',
      trim: true
    },
    location: {
      type: String,
      default: ''
    },
    unit: {
      type: String,
      default: 'unidad'
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    minStock: {
      type: Number,
      default: 0,
      min: 0
    },
    price: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    }
  },
  { timestamps: true }
);

resourceSchema.pre('validate', function () {
  if (this.availableQuantity > this.totalQuantity) {
    this.availableQuantity = this.totalQuantity;
  }
});

module.exports = mongoose.model('Resource', resourceSchema);
