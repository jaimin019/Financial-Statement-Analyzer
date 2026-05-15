import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: {
    type: String,
    required: false,
  },
  googleId: {
    type: String,
    sparse: true,
    index: true,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  avatarUrl: {
    type: String,
    default: null,
  },
  displayName: {
    type: String,
    default: null,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLoginAt: {
    type: Date,
  },
});

// Strip passwordHash from all JSON serialization
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.googleId;
    return ret;
  },
});

/**
 * Compare a plaintext password against the stored hash.
 * @param {string} plaintext
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = function (plaintext) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plaintext, this.passwordHash);
};

/**
 * Create a new user with a securely hashed password.
 * @param {string} email
 * @param {string} plaintext
 * @returns {Promise<User>}
 */
userSchema.statics.createWithPassword = async function (email, plaintext) {
  const passwordHash = await bcrypt.hash(plaintext, 12);
  return this.create({ 
    email, 
    passwordHash, 
    authProvider: 'local', 
    emailVerified: false 
  });
};

/**
 * Find or create a user from a Google OAuth profile.
 * @param {Object} profile
 * @returns {Promise<{user: User, isNew: boolean}>}
 */
userSchema.statics.findOrCreateFromGoogle = async function (profile) {
  const email = profile.emails[0].value.toLowerCase();
  
  // 1. Try to find by googleId
  let user = await this.findOne({ googleId: profile.id });
  if (user) {
    user.avatarUrl = profile.photos[0]?.value;
    user.lastLoginAt = new Date();
    await user.save();
    return { user, isNew: false };
  }
  
  // 2. Try to find by email
  user = await this.findOne({ email });
  if (user) {
    user.googleId = profile.id;
    user.authProvider = 'google';
    user.avatarUrl = profile.photos[0]?.value;
    user.emailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
    return { user, isNew: false };
  }
  
  // 3. Create new user
  user = await this.create({
    email,
    googleId: profile.id,
    authProvider: 'google',
    avatarUrl: profile.photos[0]?.value,
    displayName: profile.displayName,
    emailVerified: true,
    passwordHash: null,
    lastLoginAt: new Date(),
  });
  
  return { user, isNew: true };
};

export default mongoose.model('User', userSchema);
