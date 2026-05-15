import Session from '../models/Session.js';

/**
 * Validates a sessionId from params or body. Attaches session to req.session.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function validateSession(req, res, next) {
  try {
    const sessionId = req.params.sessionId || req.body.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const session = await Session.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'processing') {
      return res.status(202).json({ status: 'processing', message: 'File is still being ingested' });
    }
    if (session.status === 'error') {
      return res.status(500).json({ error: session.errorMessage });
    }

    req.validatedSession = session;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
