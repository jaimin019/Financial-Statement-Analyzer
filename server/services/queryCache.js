import crypto from 'crypto';
import { connection } from './jobQueue.js';

// ── Deterministic cache key ───────────────────────────────────
function cacheKey(sessionId, question) {
  return (
    'query:' +
    crypto
      .createHash('sha256')
      .update(`${sessionId}:${question.toLowerCase().trim()}`)
      .digest('hex')
      .slice(0, 32)
  );
}

// ── Get cached response ───────────────────────────────────────
export async function getCachedResponse(sessionId, question) {
  try {
    const key = cacheKey(sessionId, question);
    const cached = await connection.get(key);
    if (cached) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📦 Cache HIT for key ${key.slice(0, 16)}…`);
      }
      return JSON.parse(cached);
    }
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 Cache MISS for key ${key.slice(0, 16)}…`);
    }
    return null;
  } catch {
    return null; // Redis unavailable — degrade gracefully
  }
}

// ── Set cached response ───────────────────────────────────────
export async function setCachedResponse(sessionId, question, response) {
  try {
    const key = cacheKey(sessionId, question);
    const sessionSetKey = `session-keys:${sessionId}`;
    const ttl = parseInt(process.env.CACHE_TTL_SECONDS) || 3600;

    await Promise.all([
      connection.setex(key, ttl, JSON.stringify(response)),
      connection.sadd(sessionSetKey, key),            // track keys per session
      connection.expire(sessionSetKey, ttl + 60),     // expire set slightly after entries
    ]);
  } catch {
    // Redis unavailable — continue without caching
  }
}

// ── Invalidate all keys for a session ────────────────────────
export async function invalidateSession(sessionId) {
  try {
    const sessionSetKey = `session-keys:${sessionId}`;
    const keys = await connection.smembers(sessionSetKey);
    if (keys.length > 0) await connection.del(...keys);
    await connection.del(sessionSetKey);
  } catch {
    // ignore
  }
}
