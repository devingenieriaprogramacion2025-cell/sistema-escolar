const mongoose = require('mongoose');

const internalRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewComments: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'DONE'],
      default: 'PENDING'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('InternalRequest', internalRequestSchema);
