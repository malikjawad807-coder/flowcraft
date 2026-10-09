import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'flowcart-jwt-super-secret-key-change-in-production';
const COOKIE_NAME = 'flowcart_token';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }

  req.user = decoded;
  next();
}

export { COOKIE_NAME };
