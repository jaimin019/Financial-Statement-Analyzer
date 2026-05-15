/**
 * Backfill script — embeds all chunks for existing sessions
 * that were uploaded before the embedding pipeline was added.
 *
 * Usage: npm run embed:backfill
 *        (or: node scripts/embedExisting.js)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import { embedAndPersistSession } from '../services/embedder.js';

async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_ATLAS_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'financial_analyzer',
    });
    console.log('✅ MongoDB connected');

    // Find all sessions that are ready
    const sessions = await Session.find({ status: 'ready' }).lean();
    console.log(`📋 Found ${sessions.length} sessions with status 'ready'`);

    if (sessions.length === 0) {
      console.log('Nothing to do — no ready sessions found.');
      await mongoose.disconnect();
      process.exit(0);
    }

    for (const session of sessions) {
      console.log(`\n── Session: ${session.sessionId} (${session.filename}) ──`);
      try {
        const { embedded, skipped } = await embedAndPersistSession(session.sessionId);
        console.log(`   Session ${session.sessionId}: embedded ${embedded} chunks, skipped ${skipped}`);
      } catch (err) {
        console.error(`   ❌ Failed for session ${session.sessionId}:`, err.message);
      }
    }

    console.log('\n✅ Backfill complete');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Backfill script failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
