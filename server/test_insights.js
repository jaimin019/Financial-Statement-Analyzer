import 'dotenv/config';
import mongoose from 'mongoose';
import Session from './models/Session.js';

async function check() {
  await mongoose.connect(process.env.MONGODB_ATLAS_URI, { dbName: process.env.MONGODB_DB_NAME || 'financial_analyzer' });
  const docs = await Session.find().sort({ uploadedAt: -1 }).limit(1).lean();
  console.log('Session Insights:', JSON.stringify(docs[0]?.insights, null, 2));
  process.exit(0);
}
check();
