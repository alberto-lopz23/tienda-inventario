import { getConfig } from './db.js';

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export async function requireAdmin(req, res, next) {
  try {
    const token = req.headers['x-admin-token'];
    const stored = await getConfig('admin_token');
    if (!stored || token !== stored) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    next();
  } catch (err) {
    next(err);
  }
}