import { Router } from 'express';
import { db, verifyPassword, createAdminToken } from '../db.js';
import { requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    const stored = await db.get('SELECT value FROM config WHERE key = ?', ['admin_password_hash']);
    if (!stored || !verifyPassword(password || '', stored.value)) {
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