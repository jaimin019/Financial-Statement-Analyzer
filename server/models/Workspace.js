import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const workspaceSchema = new mongoose.Schema({
  userId: {
    type: ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    maxLength: 60,
  },
  description: {
    type: String,
    maxLength: 200,
    default: '',
  },
  sessionIds: [{
    type: ObjectId,
    ref: 'Session',
  }],
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    citedRows: [{
      sessionId: String,
      rowIndex: Number,
    }],
    chartData: {
      type: mongoose.Schema.Types.Mixed,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

workspaceSchema.index({ userId: 1, createdAt: -1 });

workspaceSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Workspace', workspaceSchema);
