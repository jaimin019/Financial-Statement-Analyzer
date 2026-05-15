import mongoose from 'mongoose';

const rawTransactionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  rowIndex: {
    type: Number,
    required: true,
  },
  rawData: {
    type: Map,
    of: String,
  },
  normalizedDate: {
    type: Date,
  },
  normalizedAmount: {
    type: Number,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  direction: {
    type: String,
    enum: ['debit', 'credit', 'buy', 'sell', 'unknown'],
  },
  merchantName: {
    type: String,
  },
  category: {
    type: String,
  },
});

// Compound index for efficient lookups by session + row
rawTransactionSchema.index({ sessionId: 1, rowIndex: 1 });

export default mongoose.model('RawTransaction', rawTransactionSchema);
