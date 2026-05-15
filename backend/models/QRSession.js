const mongoose = require('mongoose');

const qrSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  period: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries (sessionId is already indexed via unique: true)
qrSessionSchema.index({ date: 1, period: 1 });

module.exports = mongoose.model('QRSession', qrSessionSchema);
