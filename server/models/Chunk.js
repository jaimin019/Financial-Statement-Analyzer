import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
  },
  embedding: {
    type: [Number],
    default: [],
  },
  metadata: {
    rowIndexes: {
      type: [Number],
    },
    dateRange: {
      start: Date,
      end: Date,
    },
    categories: {
      type: [String],
    },
    totalAmount: {
      type: Number,
    },
    chunkType: {
      type: String,
      enum: ['single_row', 'daily_aggregate', 'category_aggregate'],
    },
  },
});

// Index for querying chunks by session and type
chunkSchema.index({ sessionId: 1, 'metadata.chunkType': 1 });

export default mongoose.model('Chunk', chunkSchema);
