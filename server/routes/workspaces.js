import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import Session from '../models/Session.js';

const router = Router();

// Validate workspace ownership
async function getWorkspace(workspaceId, userId) {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) return null;
  return await Workspace.findOne({ _id: workspaceId, userId });
}

/**
 * GET /api/workspaces
 * Return all workspaces for the user
 */
router.get('/', async (req, res) => {
  try {
    const workspaces = await Workspace.find({ userId: req.user.userId })
      .sort({ updatedAt: -1 })
      .populate({
        path: 'sessionIds',
        select: 'filename rowCount fileType sourceFormat uploadedAt status',
      })
      .lean();

    res.json({ workspaces });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/workspaces/:workspaceId
 * Return single workspace with populated sessions
 */
router.get('/:workspaceId', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({
      _id: req.params.workspaceId,
      userId: req.user.userId,
    }).populate({
      path: 'sessionIds',
      select: 'filename rowCount fileType sourceFormat uploadedAt status',
    }).lean();

    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/workspaces
 * Create a workspace and link sessions
 */
const workspaceValidation = [
  body('name').isString().notEmpty().trim().isLength({ max: 60 }),
  body('description').optional().isString().trim().isLength({ max: 200 }),
  body('sessionIds').optional().isArray(),
];

router.post('/', workspaceValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { name, description, sessionIds } = req.body;
  const objectIdSessionIds = (sessionIds || []).filter(id => mongoose.Types.ObjectId.isValid(id));

  try {
    // Validate that all provided sessions belong to the user
    if (objectIdSessionIds.length > 0) {
      const validSessions = await Session.countDocuments({
        _id: { $in: objectIdSessionIds },
        userId: req.user.userId,
      });
      if (validSessions !== objectIdSessionIds.length) {
        return res.status(400).json({ error: 'One or more sessions are invalid or do not belong to you.' });
      }
    }

    const workspace = new Workspace({
      userId: req.user.userId,
      name,
      description: description || '',
      sessionIds: objectIdSessionIds,
    });

    await workspace.save();

    // Sync back-references
    if (objectIdSessionIds.length > 0) {
      await Session.updateMany(
        { _id: { $in: objectIdSessionIds } },
        { $addToSet: { workspaceIds: workspace._id } }
      );
    }

    // Populate for response
    const populated = await Workspace.findById(workspace._id).populate({
      path: 'sessionIds',
      select: 'filename rowCount fileType sourceFormat uploadedAt status',
    }).lean();

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/workspaces/:workspaceId
 * Update workspace details or session bindings
 */
router.patch('/:workspaceId', [
  body('name').optional().isString().trim().isLength({ max: 60 }),
  body('description').optional().isString().trim().isLength({ max: 200 }),
  body('sessionIds').optional().isArray(),
], async (req, res) => {
  try {
    const workspace = await getWorkspace(req.params.workspaceId, req.user.userId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const { name, description, sessionIds } = req.body;

    if (name !== undefined) workspace.name = name;
    if (description !== undefined) workspace.description = description;

    if (sessionIds !== undefined) {
      const objectIdSessionIds = sessionIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      
      const validSessionsCount = await Session.countDocuments({
        _id: { $in: objectIdSessionIds },
        userId: req.user.userId,
      });
      if (validSessionsCount !== objectIdSessionIds.length) {
        return res.status(400).json({ error: 'One or more sessions are invalid.' });
      }

      const oldSessionIds = workspace.sessionIds.map(id => id.toString());
      const newSessionIds = objectIdSessionIds.map(id => id.toString());

      const added = newSessionIds.filter(id => !oldSessionIds.includes(id));
      const removed = oldSessionIds.filter(id => !newSessionIds.includes(id));

      workspace.sessionIds = objectIdSessionIds;

      // Sync back-references
      if (added.length > 0) {
        await Session.updateMany(
          { _id: { $in: added } },
          { $addToSet: { workspaceIds: workspace._id } }
        );
      }
      if (removed.length > 0) {
        await Session.updateMany(
          { _id: { $in: removed } },
          { $pull: { workspaceIds: workspace._id } }
        );
      }
    }

    await workspace.save();

    const populated = await Workspace.findById(workspace._id).populate({
      path: 'sessionIds',
      select: 'filename rowCount fileType sourceFormat uploadedAt status',
    }).lean();

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId
 * Delete a workspace (does not delete sessions)
 */
router.delete('/:workspaceId', async (req, res) => {
  try {
    const workspace = await getWorkspace(req.params.workspaceId, req.user.userId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    // Remove references from sessions
    await Session.updateMany(
      { workspaceIds: workspace._id },
      { $pull: { workspaceIds: workspace._id } }
    );

    await workspace.deleteOne();
    res.json({ message: 'Workspace deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/workspaces/:workspaceId/sessions
 * Add a single session to workspace
 */
router.post('/:workspaceId/sessions', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    const workspace = await getWorkspace(req.params.workspaceId, req.user.userId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const session = await Session.findOne({ _id: sessionId, userId: req.user.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (!workspace.sessionIds.includes(session._id)) {
      workspace.sessionIds.push(session._id);
      await workspace.save();
    }
    
    if (!session.workspaceIds.includes(workspace._id)) {
      session.workspaceIds.push(workspace._id);
      await session.save();
    }

    res.json({ message: 'Session added to workspace' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/sessions/:sessionId
 * Remove single session from workspace
 */
router.delete('/:workspaceId/sessions/:sessionId', async (req, res) => {
  try {
    const workspace = await getWorkspace(req.params.workspaceId, req.user.userId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const { sessionId } = req.params;
    
    workspace.sessionIds = workspace.sessionIds.filter(id => id.toString() !== sessionId);
    await workspace.save();

    await Session.updateOne(
      { _id: sessionId },
      { $pull: { workspaceIds: workspace._id } }
    );

    res.json({ message: 'Session removed from workspace' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/workspaces/:workspaceId/messages?page=1&limit=50
 * Returns paginated message history for a workspace.
 */
router.get('/:workspaceId/messages', async (req, res) => {
  try {
    const workspace = await getWorkspace(req.params.workspaceId, req.user.userId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);

    const totalMessages = workspace.messages?.length ?? 0;

    // Slice from the end for most-recent-first, then reverse for chronological order
    const startIdx = Math.max(0, totalMessages - (page * limit));
    const endIdx = Math.max(0, totalMessages - ((page - 1) * limit));
    const messages = (workspace.messages || []).slice(startIdx, endIdx).map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      citedRows: m.citedRows ?? [],
      chartData: m.chartData ?? null,
    }));

    return res.json({
      messages,
      pagination: {
        page,
        limit,
        total: totalMessages,
        hasMore: startIdx > 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
