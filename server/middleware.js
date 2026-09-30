import { verifyAdminToken } from './db.js';

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export async function requireAdmin(req, res, next) {
  try {
    const token = req.headers['x-admin-token'];
    if (!token || !(await verifyAdminToken(token))) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    next();
  } catch (err) {
    next(err);
  }
}
