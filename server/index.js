import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import helmet from 'helmet';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from './config/passport.js';

import uploadRouter from './routes/upload.js';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import reportsRouter from './routes/reports.js';
import adminRouter from './routes/admin.js';
import workspacesRouter from './routes/workspaces.js';
import analyticsRouter from './routes/analytics.js';
import RawTransaction from './models/RawTransaction.js';
import { authenticate } from './middleware/authenticate.js';
import { adminOnly } from './middleware/adminOnly.js';
import { uploadLimiter, chatLimiter, authLimiter } from './middleware/rateLimiter.js';
import { validateSession } from './middleware/validateSession.js';

// ── Environment validation ───────────────────────────────────
const REQUIRED_ENV = [
  'MONGODB_ATLAS_URI',
  'MONGODB_DB_NAME',
  'GROQ_API_KEY',
  'JWT_SECRET',
  'VECTOR_INDEX_NAME',
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ── Trust proxy (required for Render, rate limiting, secure cookies) ──
app.set('trust proxy', 1);

// ── Security headers ─────────────────────────────────────────
app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https://router.huggingface.co', 'https://api.groq.com'],
    },
  })
);

// ── General middleware ───────────────────────────────────────
const corsOptions = {
  origin: [
    'http://localhost:5173',
    process.env.APP_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());

// ── Session & Passport (Week 7) ──────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_ATLAS_URI,
    dbName: process.env.MONGODB_DB_NAME || 'financial_analyzer',
    collectionName: 'sessions',
    ttl: 10 * 60,
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ── Auth routes (rate limited, NOT behind authenticate) ──────
app.use('/api/auth', authLimiter, authRouter);

// ── Protected API routes ─────────────────────────────────────
// Upload limiter only on POST (the actual file upload), not on GET endpoints
app.use('/api/upload', authenticate, uploadRouter);
app.post('/api/upload', uploadLimiter); // rate-limit just the upload POST
app.use('/api/chat', chatLimiter, authenticate, chatRouter);
app.use('/api/reports', authenticate, reportsRouter);
app.use('/api/admin', authenticate, adminOnly, adminRouter);
app.use('/api/workspaces', authenticate, workspacesRouter);
app.use('/api/analytics', authenticate, analyticsRouter);

// ── GET /api/sessions/:sessionId/rows (must be before uploadRouter) ─────
app.get('/api/sessions/:sessionId/rows', authenticate, validateSession, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '');
    const indexesParam = req.query.indexes;

    if (!indexesParam) {
      return res.status(400).json({ error: 'Query param "indexes" is required (e.g. ?indexes=1,5,12)' });
    }

    const indexes = indexesParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    if (indexes.length === 0) {
      return res.status(400).json({ error: 'No valid row indexes provided' });
    }

    const rows = await RawTransaction.find(
      { sessionId: safeSessionId, rowIndex: { $in: indexes } }
    ).lean();

    return res.json({ rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Session sub-routes: messages + insights ───────────────────
// uploadRouter handles /sessions/:id/messages and /sessions/:id/insights
// Mounted AFTER rows so rows wins the more-specific match
app.use('/api/sessions', authenticate, uploadRouter);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ── Production: serve React build ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    // Only serve index.html for non-API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(join(__dirname, '../client/dist/index.html'));
  });
}

// ── Global error handler ─────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Unhandled rejection safety net ──────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  // Do NOT crash the process in production
});

// ── Database & Server ────────────────────────────────────────
let server;

async function start(retries = 5, delay = 2000) {
  while (retries > 0) {
    try {
      await mongoose.connect(process.env.MONGODB_ATLAS_URI, {
        dbName: process.env.MONGODB_DB_NAME || 'financial_analyzer',
      });
      console.log('✅ MongoDB connected');

      server = app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
      return;
    } catch (err) {
      console.error(`❌ Failed to start server. Retries left: ${retries - 1}. Error: ${err.message}`);
      retries -= 1;
      if (retries === 0) {
        console.error('❌ Server failed to connect to MongoDB after multiple attempts. Exiting.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

// ── Graceful shutdown ────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Closing server gracefully...`);
  server.close(async () => {
    // Close Redis connection (if available)
    try {
      const { connection } = await import('./services/jobQueue.js');
      await connection.quit();
      console.log('Redis connection closed.');
    } catch {
      // Redis may not be initialized — continue
    }

    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
