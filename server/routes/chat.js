import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Session from '../models/Session.js';
import Workspace from '../models/Workspace.js';
import { runRAGQuery, runWorkspaceRAGQuery } from '../services/ragChain.js';

const router = Router();

// ── Input validation rules ──────────────────────────────────
const chatValidation = [
  body('sessionId').isString().notEmpty().trim(),
  body('question').isString().notEmpty().trim().isLength({ max: 1000 }),
  body('chatHistory').optional().isArray({ max: 20 }),
];

/**
 * POST /api/chat
 * SSE streaming RAG endpoint. Emits: status → tokens → citations → done
 */
router.post('/', chatValidation, async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { sessionId, question, chatHistory } = req.body;

  // Sanitize sessionId — strip non-alphanumeric chars except hyphens
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '');

  // Validate session exists and is ready
  const sessionFilter = req.user?.userId
    ? { sessionId: safeSessionId, userId: req.user.userId }
    : { sessionId: safeSessionId };

  const session = await Session.findOne(sessionFilter);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.status !== 'ready') {
    return res.status(202).json({
      status: session.status,
      message: session.status === 'processing'
        ? 'File is still being ingested'
        : session.errorMessage,
    });
  }

  // ── Set SSE headers ─────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    // ── 1. Check Query Cache ─────────────────────────────
    const { getCachedResponse, setCachedResponse } = await import('../services/queryCache.js');
    const cached = await getCachedResponse(safeSessionId, question);

    if (cached) {
      send('status', { message: 'Retrieving cached answer...' });
      send('token', { token: cached.answer });
      send('citations', {
        citedRowIndexes: cached.citedRowIndexes,
        sourceTransactions: cached.sourceTransactions,
      });
      if (cached.chartData) {
        send('chart', { chartData: cached.chartData });
      }
      send('done', { sessionId: safeSessionId, cached: true });
      res.end();
      return;
    }

    send('status', { message: 'Searching your transactions...' });

    // ── 2. Chart Detection ───────────────────────────────
    const CHART_TRIGGERS = [
      'monthly', 'weekly', 'over time', 'trend', 'breakdown',
      'compare', 'by category', 'distribution', 'chart',
      'graph', 'visualize', 'show me'
    ];
    const wantsChart = CHART_TRIGGERS.some(t => question.toLowerCase().includes(t));

    // ── 3. Execute RAG ───────────────────────────────────
    const { runStructuredRAGQuery } = await import('../services/ragChain.js');
    
    const ragFn = wantsChart ? runStructuredRAGQuery : runRAGQuery;
    const { answer, chartData, citedRowIndexes, sourceTransactions } = await ragFn({
      sessionId: safeSessionId,
      question,
      chatHistory: chatHistory ?? [],
      onToken: (token) => {
        if (!aborted) send('token', { token });
      },
    });

    if (aborted) return;

    send('citations', { citedRowIndexes, sourceTransactions });
    if (chartData) {
      send('chart', { chartData });
    }

    // ── 4. Persist conversation turns ────────────────────
    await Session.findOneAndUpdate(
      { sessionId: safeSessionId },
      {
        $push: {
          messages: {
            $each: [
              { role: 'user', content: question, timestamp: new Date() },
              { role: 'assistant', content: answer, timestamp: new Date(), citedRows: citedRowIndexes, chartData },
            ],
          },
        },
      }
    );

    // ── 5. Save to Cache ─────────────────────────────────
    const shouldCache =
      !question.toLowerCase().includes('today') &&
      !question.toLowerCase().includes('now') &&
      !answer.includes('could not find sufficient data');

    if (shouldCache) {
      await setCachedResponse(safeSessionId, question, {
        answer, citedRowIndexes, sourceTransactions, chartData
      });
    }

    send('done', { sessionId: safeSessionId });
    res.end();
  } catch (err) {
    console.error('❌ Chat SSE error:', err.message);
    if (!aborted) {
      send('error', { message: err.message });
      res.end();
    }
  }
});

// ── Workspace Chat Endpoint ─────────────────────────────────

const workspaceChatValidation = [
  body('workspaceId').isString().notEmpty().trim(),
  body('question').isString().notEmpty().trim().isLength({ max: 1000 }),
  body('chatHistory').optional().isArray({ max: 20 }),
];

/**
 * POST /api/chat/workspace
 * SSE streaming RAG endpoint for multi-file workspace queries.
 */
router.post('/workspace', workspaceChatValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { workspaceId, question, chatHistory } = req.body;

  // Validate workspace exists and belongs to the user
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    userId: req.user.userId,
  }).populate({
    path: 'sessionIds',
    select: 'sessionId filename rowCount fileType status',
  });

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  // Check all sessions are ready
  const notReady = workspace.sessionIds.filter(s => s.status !== 'ready');
  if (notReady.length > 0) {
    return res.status(202).json({
      status: 'processing',
      message: `${notReady.length} session(s) are still being processed.`,
    });
  }

  // ── Set SSE headers ─────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    send('status', { message: `Searching across ${workspace.sessionIds.length} statements...` });

    const { answer, citedRowIndexes, sourceTransactions, sourceFiles } = await runWorkspaceRAGQuery({
      workspaceId,
      question,
      chatHistory: chatHistory ?? [],
      workspace,
      onToken: (token) => {
        if (!aborted) send('token', { token });
      },
    });

    if (aborted) return;

    send('citations', { citedRowIndexes, sourceTransactions, sourceFiles });

    // Persist conversation to workspace
    await Workspace.findByIdAndUpdate(workspaceId, {
      $push: {
        messages: {
          $each: [
            { role: 'user', content: question, timestamp: new Date() },
            { role: 'assistant', content: answer, timestamp: new Date(), citedRows: citedRowIndexes },
          ],
        },
      },
    });

    send('done', { workspaceId });
    res.end();
  } catch (err) {
    console.error('❌ Workspace Chat SSE error:', err.message);
    if (!aborted) {
      send('error', { message: err.message });
      res.end();
    }
  }
});

export default router;
