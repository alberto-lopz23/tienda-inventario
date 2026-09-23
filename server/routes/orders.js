import { Router } from 'express';
import { db, transaction } from '../db.js';
import { requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

const MOVEMENT = 'venta';

const ORDER_ATTEMPTS_MAX = 5;
const ORDER_ATTEMPTS_WINDOW = 10 * 60 * 1000;
const orderAttempts = new Map();

function pruneExpired(map, now) {
  if (map.size < 1000) return;
  for (const [k, v] of map) {
    if (now - v.at > ORDER_ATTEMPTS_WINDOW) map.delete(k);
  }
}

function orderLimiter(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  pruneExpired(orderAttempts, now);
  const rec = orderAttempts.get(key) || { count: 0, at: now };
  if (now - rec.at > ORDER_ATTEMPTS_WINDOW) {
    rec.count = 0;
    rec.at = now;
  }
  if (rec.count >= ORDER_ATTEMPTS_MAX) {
    return res.status(429).json({ error: 'Demasiados pedidos en poco tiempo. Intenta más tarde.' });
  }
  req.bumpOrders = () => {
    rec.count += 1;
    rec.at = now;
    orderAttempts.set(key, rec);
  };
  orderAttempts.set(key, rec);
  next();
}

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    let sql = 'SELECT * FROM orders';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC, id DESC';
    const rows = await db.all(sql, params);
    res.json(rows.map((o) => ({ ...o, items: JSON.parse(o.items) })));
  })
);

router.post(
  '/',
  orderLimiter,
  asyncHandler(async (req, res) => {
    const { customer_name, phone, items, note, website } = req.body || {};
    if (String(website || '').trim()) {
      return res.status(400).json({ error: 'Faltan datos del pedido' });
    }
    const list = Array.isArray(items) ? items : [];
    if (!customer_name || !String(customer_name).trim() || list.length === 0) {
      return res.status(400).json({ error: 'Faltan datos del pedido' });
    }

    const id = await transaction(async (tx) => {
      let serverTotal = 0;
      for (const item of list) {
        const p = await tx.get('SELECT * FROM products WHERE id = ? AND active = 1', [item.product_id]);
        if (!p) {
          const err = new Error('Producto no disponible');
          err.status = 400;
          throw err;
        }
        const qty = Math.max(1, Math.round(Number(item.quantity) || 0));
        if (item.color_id) {
          const color = await tx.get('SELECT * FROM product_colors WHERE id = ? AND product_id = ?', [item.color_id, p.id]);
          if (!color) {
            const err = new Error(`Color no disponible para: ${p.name}`);
            err.status = 400;
            throw err;
          }
          if (color.stock < qty) {
            const err = new Error(`Stock insuficiente para: ${p.name} (${color.name})`);
            err.status = 400;
            throw err;
          }
        } else if (p.has_colors) {
          const err = new Error(`Elige un color para: ${p.name}`);
          err.status = 400;
          throw err;
        } else if (p.stock < qty) {
          const err = new Error(`Stock insuficiente para: ${p.name}`);
          err.status = 400;
          throw err;
        }
        const install = !!item.with_installation && !!p.requires_installation;
        serverTotal += p.price_cents * qty + (install ? p.installation_price_cents * qty : 0);
      }
      for (const item of list) {
        const p = await tx.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
        const qty = Math.max(1, Math.round(Number(item.quantity) || 0));
        const color = item.color_id ? await tx.get('SELECT * FROM product_colors WHERE id = ?', [item.color_id]) : null;
        if (color) await tx.run('UPDATE product_colors SET stock = stock - ? WHERE id = ?', [qty, color.id]);
        await tx.run('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, p.id]);
        const suffix = color ? ` (${color.name})` : '';
        await tx.run('INSERT INTO movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
          p.id,
          MOVEMENT,
          -qty,
          `Pedido de ${String(customer_name).trim()}${suffix}`
        ]);
      }
      const result = await tx.run(
        `INSERT INTO orders (customer_name, phone, items, total_cents, status, note)
         VALUES (?, ?, ?, ?, 'pendiente', ?) RETURNING id`,
        [
          String(customer_name).trim(),
          String(phone || ''),
          JSON.stringify(list),
          serverTotal,
          String(note || '')
        ]
      );
      return result.lastInsertRowid;
    });

    req.bumpOrders();
    res.status(201).json(await db.get('SELECT * FROM orders WHERE id = ?', [id]));
  })
);

router.put(
  '/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const o = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!o) return res.status(404).json({ error: 'Pedido no encontrado' });

    const { status } = req.body || {};
    if (!['pendiente', 'confirmado', 'cancelado', 'entregado'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    await transaction(async (tx) => {
      if (status === 'cancelado' && o.status !== 'cancelado') {
        for (const item of JSON.parse(o.items)) {
          const p = await tx.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
          if (!p) continue;
          const qty = Math.max(1, Math.round(Number(item.quantity) || 0));
          const color = item.color_id ? await tx.get('SELECT * FROM product_colors WHERE id = ?', [item.color_id]) : null;
          if (color) await tx.run('UPDATE product_colors SET stock = stock + ? WHERE id = ?', [qty, color.id]);
          await tx.run('UPDATE products SET stock = stock + ? WHERE id = ?', [qty, p.id]);
          await tx.run('INSERT INTO movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
            p.id,
            'entrada',
            qty,
            `Cancelación de pedido de ${String(o.customer_name).trim()}`
          ]);
        }
      }
      await tx.run('UPDATE orders SET status = ? WHERE id = ?', [status, o.id]);
    });

    res.json(await db.get('SELECT * FROM orders WHERE id = ?', [o.id]));
  })
);

export default router;