import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Waitlist from '../models/Waitlist.js';
import passport from '../config/passport.js';
import { authenticate } from '../middleware/authenticate.js';
import { waitlistLimiter } from '../middleware/rateLimiter.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * POST /api/auth/register
 * Creates a new user account and returns a JWT.
 */
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Validate inputs
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!/\d/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one number.' });
  }

  // Check for existing user
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered.' });
  }

  // Create user
  const user = await User.createWithPassword(email, password);
  const token = signToken(user);

  return res.status(201).json({
    token,
    user: { email: user.email, createdAt: user.createdAt, isAdmin: user.isAdmin },
  });
});

/**
 * POST /api/auth/login
 * Validates credentials and returns a JWT.
 */
router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: info?.message ?? 'Invalid credentials' });
    }
    const token = signToken(user);
    user.lastLoginAt = new Date();
    await user.save();
    
    return res.status(200).json({
      token,
      user: { email: user.email, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, avatarUrl: user.avatarUrl, isAdmin: user.isAdmin },
    });
  })(req, res, next);
});

// ── Google OAuth Routes ──────────────────────────────────────

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account',
}));

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get('/google/callback', 
  passport.authenticate('google', { 
    session: false, 
    failureRedirect: `${process.env.APP_URL || 'http://localhost:5173'}/auth?error=google_failed` 
  }),
  (req, res) => {
    const { user, isNew } = req.user;
    const token = signToken(user);

    const redirectUrl = new URL(
      '/auth/callback',
      process.env.APP_URL || 'http://localhost:5173'
    );
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('isNew', String(isNew));
    
    res.redirect(redirectUrl.toString());
  }
);

/**
 * POST /api/auth/google/disconnect
 * Disconnect Google (for users who linked accounts)
 */
router.post('/google/disconnect', authenticate, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!user.passwordHash) {
    return res.status(400).json({ error: 'Set a password before disconnecting Google' });
  }

  await User.findByIdAndUpdate(req.user.userId, {
    $unset: { googleId: 1 },
    $set: { authProvider: 'local' }
  });

  return res.status(200).json({ message: 'Google disconnected' });
});

// ── Waitlist Routes ──────────────────────────────────────────

/**
 * POST /api/waitlist
 * Join waitlist (public)
 */
router.post('/waitlist', waitlistLimiter, async (req, res) => {
  const { email } = req.body;
  
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  
  try {
    const existing = await Waitlist.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(200).json({ message: 'You are already on the waitlist' });
    }
    
    await Waitlist.create({ email: email.toLowerCase().trim() });
    
    try {
      await resend.emails.send({
        from: 'FinSight AI <noreply@yourdomain.com>',
        to: email,
        subject: 'You are on the waitlist',
        html: `<p>Thanks for your interest in FinSight AI. We will notify you when early access opens.</p><p>In the meantime, you can already sign up at: ${process.env.APP_URL || 'http://localhost:5173'}/auth</p>`
      });
    } catch (emailErr) {
      console.error('Failed to send waitlist email:', emailErr);
    }
    
    return res.status(200).json({ message: 'Added to waitlist' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 */
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ email: user.email, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, isAdmin: user.isAdmin });
});

/**
 * POST /api/auth/logout
 * Stateless JWT — client deletes the token.
 */
router.post('/logout', (_req, res) => {
  return res.json({ message: 'Logged out successfully' });
});

export default router;
