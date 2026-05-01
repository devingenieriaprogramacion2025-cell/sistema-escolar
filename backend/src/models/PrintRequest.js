const mongoose = require('mongoose');

const printRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    documentName: {
      type: String,
      required: true,
      trim: true
    },
    pages: {
      type: Number,
      required: true,
      min: 1
    },
    copies: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    color: {
      type: Boolean,
      default: false
    },
    doubleSided: {
      type: Boolean,
      default: false
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
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'DONE'],
      default: 'PENDING'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PrintRequest', printRequestSchema);
