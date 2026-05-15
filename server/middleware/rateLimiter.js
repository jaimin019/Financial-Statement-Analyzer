import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Upload limiter: 10 uploads per user per hour.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Upload limit reached. Maximum 10 uploads per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip),
});

/**
 * Chat limiter: 20 queries per user per minute.
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many queries. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip),
});

/**
 * Auth limiter: 10 auth attempts per IP per 15 minutes.
 * Uses IP (not userId) since user may not be known yet.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Waitlist limiter: 3 requests per IP per hour.
 */
export const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many waitlist attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});


