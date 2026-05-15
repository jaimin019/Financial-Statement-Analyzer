import jwt from 'jsonwebtoken';

/**
 * Express middleware that validates a Bearer JWT token.
 * Attaches decoded { userId, email } to req.user on success.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId, email: decoded.email, isAdmin: decoded.isAdmin };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
