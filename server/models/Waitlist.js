import mongoose from 'mongoose';

const waitlistSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  source: {
    type: String,
    default: 'landing_page',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  converted: {
    type: Boolean,
    default: false,
  },
});

export default mongoose.model('Waitlist', waitlistSchema);
