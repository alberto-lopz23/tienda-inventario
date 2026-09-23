import { Router } from 'express';
import { db, hashPassword } from '../db.js';
import { requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

async function readShop() {
  const shop = await db.get('SELECT value FROM config WHERE key = ?', ['shop_name']);
  const wa = await db.get('SELECT value FROM config WHERE key = ?', ['whatsapp_number']);
  return { shop_name: shop ? shop.value : '', whatsapp_number: wa ? wa.value : '' };
}

router.get(
  '/shop',
  asyncHandler(async (req, res) => {
    res.json(await readShop());
  })
);

router.get(
  '/config',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await readShop());
  })
);

router.put(
  '/config',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { shop_name, whatsapp_number } = req.body || {};
    if (shop_name !== undefined) {
      await db.run('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [
        'shop_name',
        String(shop_name).trim()
      ]);
    }
    if (whatsapp_number !== undefined) {
      await db.run('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [
        'whatsapp_number',
        String(whatsapp_number).replace(/\D/g, '')
      ]);
    }
    res.json(await readShop());
  })
);

router.post(
  '/config/password',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    await db.run('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [
      'admin_password_hash',
      hashPassword(String(password))
    ]);
    res.json({ ok: true });
  })
);

export default router;