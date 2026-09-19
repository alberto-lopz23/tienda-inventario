import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

function serialize(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price_cents: p.price_cents,
    category: p.category,
    image: p.image,
    stock: p.stock,
    low_stock_threshold: p.low_stock_threshold,
    requires_installation: !!p.requires_installation,
    installation_price_cents: p.installation_price_cents || 0,
    active: !!p.active,
    created_at: p.created_at
  };
}

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const rows = await db.all('SELECT DISTINCT category FROM products WHERE category != ? ORDER BY category', ['']);
    res.json(rows.map((r) => r.category));
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, q } = req.query;
    let sql = 'SELECT * FROM products WHERE active = 1';
    const params = [];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (q) {
      sql += ' AND (name ILIKE ? OR description ILIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY name';
    res.json((await db.all(sql, params)).map(serialize));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const p = await db.get('SELECT * FROM products WHERE id = ? AND active = 1', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(serialize(p));
  })
);

// ---- Admin ----

router.get(
  '/admin/list',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = await db.all('SELECT * FROM products ORDER BY name');
    res.json(rows.map(serialize));
  })
);

router.post(
  '/admin',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      price_cents,
      category,
      image,
      stock,
      low_stock_threshold,
      requires_installation,
      installation_price_cents
    } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const result = await db.run(
      `INSERT INTO products (name, description, price_cents, category, image, stock, low_stock_threshold, requires_installation, installation_price_cents, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING id`,
      [
        String(name).trim(),
        String(description || ''),
        Math.round(Number(price_cents) || 0),
        String(category || ''),
        String(image || ''),
        Math.max(0, Math.round(Number(stock) || 0)),
        Math.max(0, Math.round(Number(low_stock_threshold) || 5)),
        requires_installation ? 1 : 0,
        Math.round(Number(installation_price_cents) || 0)
      ]
    );

    if (Math.round(Number(stock) || 0) > 0) {
      await db.run('INSERT INTO movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
        result.lastInsertRowid,
        'entrada',
        Math.round(Number(stock)),
        'Stock inicial'
      ]);
    }
    res.json(serialize(await db.get('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid])));
  })
);

router.put(
  '/admin/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const p = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });

    const b = req.body || {};
    await db.run(
      `UPDATE products SET name = ?, description = ?, price_cents = ?, category = ?, image = ?,
         stock = ?, low_stock_threshold = ?, requires_installation = ?, installation_price_cents = ?, active = ? WHERE id = ?`,
      [
        String(b.name ?? p.name).trim(),
        String(b.description ?? p.description),
        Math.round(Number(b.price_cents ?? p.price_cents)),
        String(b.category ?? p.category),
        String(b.image ?? p.image),
        Math.max(0, Math.round(Number(b.stock ?? p.stock))),
        Math.max(0, Math.round(Number(b.low_stock_threshold ?? p.low_stock_threshold))),
        b.requires_installation === undefined ? p.requires_installation : b.requires_installation ? 1 : 0,
        Math.max(0, Math.round(Number(b.installation_price_cents ?? p.installation_price_cents))),
        b.active === undefined ? p.active : b.active ? 1 : 0,
        p.id
      ]
    );
    res.json(serialize(await db.get('SELECT * FROM products WHERE id = ?', [p.id])));
  })
);

router.delete(
  '/admin/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const p = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM movements WHERE product_id = ?', [p.id]);
      await tx.run('DELETE FROM products WHERE id = ?', [p.id]);
    });
    res.json({ ok: true });
  })
);

router.post(
  '/admin/:id/stock',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const p = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });

    const { quantity, type, note } = req.body || {};
    const delta = Math.abs(Math.round(Number(quantity) || 0));
    if (delta <= 0) return res.status(400).json({ error: 'Cantidad inválida' });

    const t = String(type || 'ajuste');
    let newStock = p.stock;
    if (t === 'entrada') newStock += delta;
    else if (t === 'salida') newStock = Math.max(0, newStock - delta);
    else newStock = Math.max(0, delta);

    await db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, p.id]);
    await db.run('INSERT INTO movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
      p.id,
      t,
      t === 'entrada' ? delta : -delta,
      String(note || '')
    ]);
    res.json(serialize(await db.get('SELECT * FROM products WHERE id = ?', [p.id])));
  })
);

export default router;