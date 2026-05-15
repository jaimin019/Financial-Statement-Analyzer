import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import RawTransaction from '../models/RawTransaction.js';
import Chunk from '../models/Chunk.js';
import { parseCSV } from '../services/csvParser.js';
import { parsePDF } from '../services/pdfParser.js';
import { buildChunks } from '../services/chunkBuilder.js';
import { embedAndPersistSession } from '../services/embedder.js';
import { validateSession } from '../middleware/validateSession.js';
import { generateInsights } from '../services/ragChain.js';
import { addEmbeddingJob } from '../services/jobQueue.js';

const router = Router();

// ── Multer config ───────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/octet-stream',
      'text/plain',
      'application/pdf',
    ];
    const hasCSVExtension = file.originalname.toLowerCase().endsWith('.csv');
    const hasPDFExtension = file.originalname.toLowerCase().endsWith('.pdf');
    if (allowedMimes.includes(file.mimetype) || hasCSVExtension || hasPDFExtension) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV or PDF files are allowed'), false);
    }
  },
});

/**
 * POST /api/upload
 * Returns in < 3 seconds. Embedding + insights happen in background worker.
 */
router.post('/', upload.single('file'), async (req, res) => {
  let session = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Use form field "file".' });
    }

    const isPDF = req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');
    let parsedData;
    if (isPDF) {
      parsedData = await parsePDF(req.file.buffer);
    } else {
      parsedData = parseCSV(req.file.buffer);
    }

    const { rows, headerMap, fileType } = parsedData;

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File contains no data rows.' });
    }

    // Create session in 'processing' state
    session = new Session({
      filename: req.file.originalname,
      fileType,
      sourceFormat: isPDF ? 'pdf' : 'csv',
      userId: req.user?.userId ?? null,
    });
    await session.save();
    const { sessionId } = session;

    // Persist raw transactions
    const rawDocs = rows.map((row) => ({
      sessionId,
      rowIndex: row.rowIndex,
      rawData: row.rawData,
      normalizedDate: row.normalizedDate,
      normalizedAmount: row.normalizedAmount,
      currency: 'INR',
      direction: row.direction,
      merchantName: row.merchantName,
      category: row.category,
    }));
    await RawTransaction.insertMany(rawDocs, { ordered: false });

    const columnHeaders = Object.values(headerMap).filter(Boolean);
    session.rowCount = rows.length;
    session.columnHeaders = columnHeaders;
    await session.save();

    // Save chunk documents (embeddings will be filled by worker)
    const chunkDocs = buildChunks(rows, sessionId, fileType);
    await Chunk.insertMany(chunkDocs);

    // Enqueue background embedding job
    let job = null;
    try {
      job = await addEmbeddingJob(sessionId);
    } catch (queueErr) {
      // If Redis is down, fall back to synchronous embedding
      console.error('Queue unavailable, falling back to sync embedding:', queueErr.message);
      const { embedAndPersistSession } = await import('../services/embedder.js');
      const { generateInsights } = await import('../services/ragChain.js');
      const { embedded } = await embedAndPersistSession(sessionId);
      const insights = await generateInsights(sessionId, { rowCount: rows.length, fileType });
      session.status = 'ready';
      session.insights = { ...insights, generatedAt: new Date() };
      await session.save();
      return res.status(200).json({
        sessionId, filename: req.file.originalname, fileType,
        rowCount: rows.length, columnHeaders,
        chunkCount: chunkDocs.length, embeddedChunks: embedded,
        status: 'ready', jobId: null,
      });
    }

    // Return immediately — worker will finish in background
    return res.status(200).json({
      sessionId,
      filename: req.file.originalname,
      fileType,
      rowCount: rows.length,
      columnHeaders,
      chunkCount: chunkDocs.length,
      status: 'processing',
      jobId: job.id,
    });
  } catch (err) {
    if (session) {
      try {
        session.status = 'error';
        session.errorMessage = err.message;
        await session.save();
      } catch (_) { /* ignore */ }
    }
    return res.status(500).json({ error: err.message, sessionId: session?.sessionId ?? null });
  }
});

/**
 * GET /api/upload/job-status/:jobId
 * Checks status of background job.
 */
router.get('/job-status/:jobId', async (req, res) => {
  try {
    const { embeddingQueue } = await import('../services/jobQueue.js');
    const job = await embeddingQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const state = await job.getState();
    const progress = job.progress ?? 0;
    return res.json({ id: job.id, state, progress });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/upload/sessions
 * Lists sessions for the authenticated user with preview data
 * (message count, last message preview, lastActiveAt).
 */
router.get('/sessions', async (req, res) => {
  try {
    const matchStage = req.user?.userId
      ? { userId: new mongoose.Types.ObjectId(req.user.userId), status: { $in: ['ready', 'processing'] } }
      : { status: { $in: ['ready', 'processing'] } };

    const sessions = await Session.aggregate([
      { $match: matchStage },
      {
        $project: {
          sessionId: 1,
          filename: 1,
          fileType: 1,
          status: 1,
          rowCount: 1,
          uploadedAt: 1,
          messageCount: { $size: '$messages' },
          lastMessage: { $arrayElemAt: ['$messages', -1] },
          lastActiveAt: {
            $ifNull: [
              { $arrayElemAt: ['$messages.timestamp', -1] },
              '$uploadedAt',
            ],
          },
        },
      },
      { $sort: { lastActiveAt: -1 } },
      { $limit: 20 },
    ]);

    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/upload/sessions/:sessionId
 * Returns metadata for a specific session.
 */
router.get('/sessions/:sessionId', validateSession, (req, res) => {
  const s = req.validatedSession;
  res.json({
    sessionId: s.sessionId,
    filename: s.filename,
    fileType: s.fileType,
    rowCount: s.rowCount,
    columnHeaders: s.columnHeaders,
    status: s.status,
    uploadedAt: s.uploadedAt,
  });
});

/**
 * GET /api/sessions/:sessionId/messages?page=1&limit=50
 * Returns paginated message history for a session.
 */
router.get('/:sessionId/messages', validateSession, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [sessionDoc, countResult] = await Promise.all([
      Session.findOne(
        { sessionId },
        { messages: { $slice: [skip, limit] } }
      ).lean(),
      Session.aggregate([
        { $match: { sessionId } },
        { $project: { count: { $size: '$messages' } } },
      ]),
    ]);

    if (!sessionDoc) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const total = countResult[0]?.count ?? 0;
    const messages = (sessionDoc.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      citedRows: m.citedRows ?? [],
    }));

    return res.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + limit < total,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/:sessionId/insights
 * Returns generated insights or 202 if not yet ready.
 */
router.get('/:sessionId/insights', validateSession, (req, res) => {
  const { insights } = req.validatedSession;
  if (!insights || !insights.generatedAt) {
    return res.status(202).json({ status: 'generating' });
  }
  return res.json({ insights });
});

/**
 * DELETE /api/upload/sessions/:sessionId
 * Cascade-deletes a session and all associated data.
 * Verifies ownership before deleting.
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;

    // Find session and verify ownership
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (userId && session.userId && session.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // If session is still processing, try to remove the BullMQ job
    if (session.status === 'processing') {
      try {
        const { embeddingQueue } = await import('../services/jobQueue.js');
        const jobs = await embeddingQueue.getJobs(['waiting', 'active', 'delayed']);
        for (const job of jobs) {
          if (job.data?.sessionId === sessionId) {
            await job.remove().catch(() => {});
            break;
          }
        }
      } catch {
        // Redis/queue unavailable — continue with deletion
      }
    }

    // Cascade delete all associated data in parallel
    await Promise.all([
      Chunk.deleteMany({ sessionId }),
      RawTransaction.deleteMany({ sessionId }),
      Session.deleteOne({ sessionId }),
    ]);

    // Invalidate Redis cache for this session
    try {
      const { invalidateSession } = await import('../services/queryCache.js');
      await invalidateSession(sessionId);
    } catch {
      // Redis unavailable — continue
    }

    return res.status(200).json({ message: 'Session deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
