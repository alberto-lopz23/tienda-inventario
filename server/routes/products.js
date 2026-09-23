import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

const clampMoney = (n) => Math.max(0, Math.round(Number(n) || 0));
const clampStock = (n) => Math.max(0, Math.round(Number(n) || 0));
const clampDiscount = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const clampHex = (n) => /^#?[0-9a-fA-F]{3,8}$/.test(String(n || '').trim()) ? String(n).trim() : '';

function parseImages(p) {
  let imgs = [];
  try {
    imgs = JSON.parse(p.images || '[]');
  } catch {
    imgs = [];
  }
  if (!Array.isArray(imgs)) imgs = [];
  imgs = imgs.filter((u) => typeof u === 'string' && String(u).trim()).map((u) => String(u));
  if (imgs.length === 0 && p.image) imgs = [p.image];
  return imgs;
}

function normalizeColors(arr) {
  const out = [];
  for (const c of Array.isArray(arr) ? arr : []) {
    const name = String(c?.name || '').trim();
    if (!name) continue;
    out.push({
      id: c?.id ? Math.round(Number(c.id)) || undefined : undefined,
      name,
      hex: clampHex(c?.hex),
      stock: clampStock(c?.stock)
    });
  }
  return out;
}

async function loadColors(tx, productIds) {
  if (!productIds.length) return new Map();
  const rows = await tx.all(
    `SELECT * FROM product_colors WHERE product_id IN (${productIds.map(() => '?').join(',')}) ORDER BY position, id`,
    productIds
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.product_id)) map.set(r.product_id, []);
    map.get(r.product_id).push(r);
  }
  return map;
}

async function saveColors(tx, productId, colors) {
  const existing = await tx.all('SELECT id FROM product_colors WHERE product_id = ?', [productId]);
  const existingIds = new Set(existing.map((c) => c.id));
  const keepIds = new Set();
  let pos = 0;
  for (const c of colors) {
    if (c.id && existingIds.has(c.id)) {
      keepIds.add(c.id);
      await tx.run(
        'UPDATE product_colors SET name = ?, hex = ?, stock = ?, position = ? WHERE id = ? AND product_id = ?',
        [c.name, c.hex, c.stock, pos, c.id, productId]
      );
    } else {
      const r = await tx.run(
        'INSERT INTO product_colors (product_id, name, hex, stock, position) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [productId, c.name, c.hex, c.stock, pos]
      );
      keepIds.add(r.lastInsertRowid);
    }
    pos++;
  }
  for (const id of existingIds) {
    if (!keepIds.has(id)) await tx.run('DELETE FROM product_colors WHERE id = ?', [id]);
  }
}

function serializePublic(p, colors = []) {
  const images = parseImages(p);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price_cents: p.price_cents,
    category: p.category,
    image: p.image,
    images,
    stock: p.stock,
    low_stock_threshold: p.low_stock_threshold,
    requires_installation: !!p.requires_installation,
    installation_price_cents: p.installation_price_cents || 0,
    discount_percent: clampDiscount(p.discount_percent),
    has_colors: !!p.has_colors,
    colors: (colors || []).map((c) => ({ id: c.id, name: c.name, hex: c.hex, stock: c.stock }))
  };
}

function serializeAdmin(p, colors = []) {
  return { ...serializePublic(p, colors), cost_cents: p.cost_cents || 0, active: !!p.active, created_at: p.created_at };
}

function findProduct(req) {
  return (req.body || {});
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
    const rows = await db.all(sql, params);
    const map = await loadColors(db, rows.map((r) => r.id));
    res.json(rows.map((r) => serializePublic(r, map.get(r.id) || [])));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const p = await db.get('SELECT * FROM products WHERE id = ? AND active = 1', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    const map = await loadColors(db, [p.id]);
    res.json(serializePublic(p, map.get(p.id) || []));
  })
);

// ---- Admin ----

router.get(
  '/admin/list',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = await db.all('SELECT * FROM products ORDER BY name');
    const map = await loadColors(db, rows.map((r) => r.id));
    res.json(rows.map((r) => serializeAdmin(r, map.get(r.id) || [])));
  })
);

router.post(
  '/admin',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const images = Array.isArray(b.images)
      ? b.images.filter((u) => typeof u === 'string' && String(u).trim()).map((u) => String(u))
      : [];
    const colors = normalizeColors(b.colors);
    const has_colors = !!b.has_colors;
    if (has_colors && colors.length === 0) {
      return res.status(400).json({ error: 'Para usar colores agrega al menos un color' });
    }
    const stock = has_colors ? colors.reduce((s, c) => s + c.stock, 0) : clampStock(b.stock);

    const id = await db.transaction(async (tx) => {
      const result = await tx.run(
        `INSERT INTO products (name, description, price_cents, category, image, images, stock, low_stock_threshold,
           requires_installation, installation_price_cents, cost_cents, discount_percent, has_colors, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING id`,
        [
          String(b.name).trim(),
          String(b.description || ''),
          clampMoney(b.price_cents),
          String(b.category || ''),
          images[0] || '',
          JSON.stringify(images),
          stock,
          clampStock(b.low_stock_threshold || 5),
          b.requires_installation ? 1 : 0,
          clampMoney(b.installation_price_cents),
          clampMoney(b.cost_cents),
          clampDiscount(b.discount_percent),
          has_colors ? 1 : 0
        ]
      );
      const newId = result.lastInsertRowid;
      if (has_colors) {
        await saveColors(tx, newId, colors);
        for (const c of colors) {
          if (c.stock > 0) {
            await tx.run('INSERT INTO movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
              newId,
              'entrada',
              c.stock,
              `Stock inicial (${c.name})`
            ]);
          }
        }
      } else if (stock > 0) {
        await tx.run('INSERT INTO movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
          newId,
          'entrada',
          stock,
          'Stock inicial'
        ]);
      }
      return newId;
    });

    const map = await loadColors(db, [id]);
    res.status(201).json(serializeAdmin(await db.get('SELECT * FROM products WHERE id = ?', [id]), map.get(id) || []));
  })
);

router.put(
  '/admin/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const p = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });

    const b = req.body || {};
    await db.transaction(async (tx) => {
      const has_colors = b.has_colors === undefined ? !!p.has_colors : !!b.has_colors;
      const colors = Array.isArray(b.colors)
        ? normalizeColors(b.colors)
        : has_colors
          ? await tx.all('SELECT * FROM product_colors WHERE product_id = ? ORDER BY position, id', [p.id])
          : [];
      if (has_colors && colors.length === 0) {
        const err = new Error('Para usar colores agrega al menos un color');
        err.status = 400;
        throw err;
      }

      const images = Array.isArray(b.images)
        ? b.images.filter((u) => typeof u === 'string' && String(u).trim()).map((u) => String(u))
        : await tx.get('SELECT images FROM products WHERE id = ?', [p.id]).then((r) => JSON.parse(r?.images || '[]').filter(Boolean));
      const stock = has_colors ? colors.reduce((s, c) => s + c.stock, 0) : clampStock(b.stock ?? p.stock);

      await tx.run(
        `UPDATE products SET name = ?, description = ?, price_cents = ?, category = ?, image = ?, images = ?,
           stock = ?, low_stock_threshold = ?, requires_installation = ?, installation_price_cents = ?,
           cost_cents = ?, discount_percent = ?, has_colors = ?, active = ? WHERE id = ?`,
        [
          String(b.name ?? p.name).trim(),
          String(b.description ?? p.description),
          clampMoney(b.price_cents ?? p.price_cents),
          String(b.category ?? p.category),
          images[0] || '',
          JSON.stringify(images),
          stock,
          clampStock(b.low_stock_threshold ?? p.low_stock_threshold),
          b.requires_installation === undefined ? p.requires_installation : b.requires_installation ? 1 : 0,
          clampMoney(b.installation_price_cents ?? p.installation_price_cents),
          clampMoney(b.cost_cents ?? p.cost_cents),
          clampDiscount(b.discount_percent ?? p.discount_percent),
          has_colors ? 1 : 0,
          b.active === undefined ? p.active : b.active ? 1 : 0,
          p.id
        ]
      );

      if (has_colors) await saveColors(tx, p.id, colors);
      else await tx.run('DELETE FROM product_colors WHERE product_id = ?', [p.id]);
    });

    const map = await loadColors(db, [p.id]);
    res.json(serializeAdmin(await db.get('SELECT * FROM products WHERE id = ?', [p.id]), map.get(p.id) || []));
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
      await tx.run('DELETE FROM product_colors WHERE product_id = ?', [p.id]);
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

    const { quantity, type, note, color_id } = req.body || {};
    const t = String(type || 'ajuste');
    const delta = Math.abs(clampStock(quantity));
    if (delta <= 0) return res.status(400).json({ error: 'Cantidad inválida' });

    await db.transaction(async (tx) => {
      if (color_id) {
        const color = await tx.get('SELECT * FROM product_colors WHERE id = ? AND product_id = ?', [color_id, p.id]);
        if (!p.has_colors) {
          const err = new Error('Este producto no tiene colores');
          err.status = 400;
          throw err;
        }
        if (!color) {
          const err = new Error('Color no encontrado para este producto');
          err.status = 400;
          throw err;
        }
        let newColorStock = color.stock;
        if (t === 'entrada') newColorStock += delta;
        else if (t === 'salida') newColorStock = Math.max(0, newColorStock - delta);
        else newColorStock = Math.max(0, delta);
        await tx.run('UPDATE product_colors SET stock = ? WHERE id = ?', [newColorStock, color.id]);

        const rows = await tx.all('SELECT stock FROM product_colors WHERE product_id = ?', [p.id]);
        const newTotal = rows.reduce((s, r) => s + r.stock, 0);
        await tx.run('UPDATE products SET stock = ? WHERE id = ?', [newTotal, p.id]);
        await tx.run('INSERT INTO movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
          p.id,
          t,
          t === 'entrada' ? delta : -delta,
          `${String(note || '') ? `${String(note)} — ` : ''}${color.name}`
        ]);
        return;
      }

      if (p.has_colors) {
        const err = new Error('Este producto tiene colores; elige un color');
        err.status = 400;
        throw err;
      }

      let newStock = p.stock;
      if (t === 'entrada') newStock += delta;
      else if (t === 'salida') newStock = Math.max(0, newStock - delta);
      else newStock = Math.max(0, delta);
      await tx.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, p.id]);
      await tx.run('INSERT INTO movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
        p.id,
        t,
        t === 'entrada' ? delta : -delta,
        String(note || '')
      ]);
    });

    const map = await loadColors(db, [p.id]);
    res.json(serializeAdmin(await db.get('SELECT * FROM products WHERE id = ?', [p.id]), map.get(p.id) || []));
  })
);

export default router;
