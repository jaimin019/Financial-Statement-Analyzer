import 'dotenv/config';
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// ── Shared Redis connection ────────────────────────────────────
// Auto-detect Upstash SSL: rediss:// prefix requires tls option
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const useTLS = REDIS_URL.startsWith('rediss://');

const connectionOpts = {
  maxRetriesPerRequest: null,  // required by BullMQ
  enableReadyCheck: false,
  ...(useTLS ? { tls: {} } : {}),
};

export const connection = new IORedis(REDIS_URL, connectionOpts);

connection.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

// ── Embedding queue ────────────────────────────────────────────
export const embeddingQueue = new Queue(
  process.env.JOB_QUEUE_NAME || 'embedding-jobs',
  { connection }
);

// ── Queue events (for progress tracking) ─────────────────────
export const queueEvents = new QueueEvents(
  process.env.JOB_QUEUE_NAME || 'embedding-jobs',
  { connection }
);

// ── Add an embedding job ──────────────────────────────────────
/**
 * Adds a session embedding job to the queue.
 * @param {string} sessionId
 * @param {number} [priority=0]
 * @returns {Promise<import('bullmq').Job>}
 */
export async function addEmbeddingJob(sessionId, priority = 0) {
  return embeddingQueue.add(
    'embed-session',
    { sessionId },
    {
      priority,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
}
