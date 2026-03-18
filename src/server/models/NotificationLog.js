const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['test_completion', 'weekly_progress', 'test_due_date'],
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission'
  },
  testName: {
    type: String
  },
  dueDate: {
    type: Date
  },
  recipients: {
    email: [String],
    phone: [String],
    whatsapp: [String]
  },
  results: {
    email: {
      success: Boolean,
      messageId: String,
      error: String
    },
    sms: {
      success: Boolean,
      messageId: String,
      error: String
    },
    whatsapp: {
      success: Boolean,
      messageId: String,
      error: String
    }
  },
  progressData: {
    type: mongoose.Schema.Types.Mixed
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
