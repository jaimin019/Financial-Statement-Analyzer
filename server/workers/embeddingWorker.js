/**
 * Embedding Worker — runs as a SEPARATE PROCESS from the Express server.
 * Start with: node server/workers/embeddingWorker.js
 * or via:     npm run dev:worker
 *
 * NEVER import this file into index.js.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker } from 'bullmq';
import { connection } from '../services/jobQueue.js';
import { embedAndPersistSession } from '../services/embedder.js';
import { generateInsights } from '../services/ragChain.js';
import Session from '../models/Session.js';

// ── Connect to MongoDB ────────────────────────────────────────
async function connectDB(retries = 5, delay = 2000) {
  while (retries > 0) {
    try {
      await mongoose.connect(process.env.MONGODB_ATLAS_URI, {
        dbName: process.env.MONGODB_DB_NAME || 'financial_analyzer',
      });
      console.log('✅ Worker: MongoDB connected');
      return;
    } catch (err) {
      console.error(`❌ Worker: MongoDB connection failed. Retries left: ${retries - 1}. Error: ${err.message}`);
      retries -= 1;
      if (retries === 0) {
        console.error('❌ Worker: MongoDB failed to connect after multiple attempts. Exiting.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

connectDB();

// ── Worker definition ─────────────────────────────────────────
const worker = new Worker(
  process.env.JOB_QUEUE_NAME || 'embedding-jobs',
  async (job) => {
    const { sessionId } = job.data;
    console.log(`⚙️  Processing embedding job for session ${sessionId}`);

    await job.updateProgress(10);

    // 1. Embed all chunks for this session
    const { embedded, skipped } = await embedAndPersistSession(sessionId);
    await job.updateProgress(70);

    // 2. Generate financial insights
    const session = await Session.findOne({ sessionId });
    if (!session) throw new Error(`Session ${sessionId} not found in DB`);

    const insights = await generateInsights(sessionId, {
      rowCount: session.rowCount,
      fileType: session.fileType,
    });

    // 3. Mark session as ready + save insights
    await Session.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          status: 'ready',
          insights: { ...insights, generatedAt: new Date() },
        },
      }
    );

    await job.updateProgress(100);
    return { embedded, skipped, sessionId };
  },
  {
    connection,
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

// ── Event handlers ────────────────────────────────────────────
worker.on('completed', (job, result) => {
  console.log(`✅ Session ${result.sessionId} embedded: ${result.embedded} chunks`);
});

worker.on('failed', async (job, err) => {
  console.error(`❌ Embedding job failed for ${job.data.sessionId}:`, err.message);
  try {
    await Session.findOneAndUpdate(
      { sessionId: job.data.sessionId },
      { $set: { status: 'error', errorMessage: err.message } }
    );
  } catch (_) { /* ignore */ }
});

console.log('🔄 Embedding worker started — waiting for jobs...');

// ── Graceful shutdown ────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down worker gracefully...`);
  await worker.close();
  await connection.quit();
  await mongoose.connection.close();
  console.log('Worker shutdown complete.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

