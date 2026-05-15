/*
  GOOGLE OAUTH SETUP — one-time manual steps
  ─────────────────────────────────────────
  1. Go to console.cloud.google.com
  2. Create new project: "FinSight AI"
  3. APIs & Services → OAuth consent screen
     - User type: External
     - App name: FinSight AI
     - Support email: your email
     - Scopes: add email, profile
  4. APIs & Services → Credentials
     → Create credentials → OAuth 2.0 Client ID
     - Application type: Web application
     - Authorized redirect URIs:
         http://localhost:3001/api/auth/google/callback
         (add production URL later in Week 8)
  5. Copy Client ID → GOOGLE_CLIENT_ID in .env
     Copy Client Secret → GOOGLE_CLIENT_SECRET in .env
  ─────────────────────────────────────────
*/

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

// --- Local Strategy (existing email/password) ---
passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return done(null, false, { message: 'Invalid credentials' });
      if (user.authProvider === 'google' && !user.passwordHash) {
        return done(null, false, {
          message: 'This account uses Google Sign-In. Please continue with Google.'
        });
      }
      const valid = await user.comparePassword(password);
      if (!valid) return done(null, false, { message: 'Invalid credentials' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// --- Google Strategy ---
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
    scope: ['profile', 'email'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const { user, isNew } = await User.findOrCreateFromGoogle(profile);
      return done(null, { user, isNew });
    } catch (err) {
      return done(err);
    }
  }
));

export default passport;
