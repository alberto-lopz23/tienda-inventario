import { Router } from 'express';
import { db, verifyPassword, createAdminToken } from '../db.js';
import { requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

function pruneExpired(map, now) {
  if (map.size < 1000) return;
  for (const [k, v] of map) {
    if (now - v.at > WINDOW_MS) map.delete(k);
  }
}

function loginLimiter(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  pruneExpired(attempts, now);
  const rec = attempts.get(key) || { count: 0, at: now };
  if (now - rec.at > WINDOW_MS) {
    rec.count = 0;
    rec.at = now;
  }
  if (rec.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  }
  req.failLogin = () => {
    rec.count += 1;
    rec.at = now;
    attempts.set(key, rec);
  };
  attempts.set(key, rec);
  next();
}

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    const stored = await db.get('SELECT value FROM config WHERE key = ?', ['admin_password_hash']);
    if (!stored || !verifyPassword(password || '', stored.value)) {
      req.failLogin();
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = await createAdminToken();
    const shop = await db.get('SELECT value FROM config WHERE key = ?', ['shop_name']);
    res.json({ token, shop_name: shop.value });
  })
);

router.post(
  '/logout',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await db.run('DELETE FROM config WHERE key = ?', ['admin_token']);
    res.json({ ok: true });
  })
);

export default router;