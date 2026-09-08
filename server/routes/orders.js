import { Router } from 'express';
import { db, transaction } from '../db.js';
import { requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

const MOVEMENT = 'venta';

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
  asyncHandler(async (req, res) => {
    const { customer_name, phone, items, total_cents, note } = req.body || {};
    const list = Array.isArray(items) ? items : [];
    if (!customer_name || !String(customer_name).trim() || list.length === 0) {
      return res.status(400).json({ error: 'Faltan datos del pedido' });
    }

    const id = await transaction(async (tx) => {
      for (const item of list) {
        const p = await tx.get('SELECT * FROM products WHERE id = ? AND active = 1', [item.product_id]);
        if (!p) {
          const err = new Error('Producto no disponible');
          err.status = 400;
          throw err;
        }
        const qty = Math.max(1, Math.round(Number(item.quantity) || 0));
        if (p.stock < qty) {
          const err = new Error(`Stock insuficiente para: ${p.name}`);
          err.status = 400;
          throw err;
        }
      }
      for (const item of list) {
        const p = await tx.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
        const qty = Math.max(1, Math.round(Number(item.quantity) || 0));
        await tx.run('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, p.id]);
        await tx.run('INSERT INTO movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
          p.id,
          MOVEMENT,
          -qty,
          `Pedido de ${String(customer_name).trim()}`
        ]);
      }
      const result = await tx.run(
        `INSERT INTO orders (customer_name, phone, items, total_cents, status, note)
         VALUES (?, ?, ?, ?, 'pendiente', ?)`,
        [
          String(customer_name).trim(),
          String(phone || ''),
          JSON.stringify(list),
          Math.round(Number(total_cents) || 0),
          String(note || '')
        ]
      );
      return result.lastInsertRowid;
    });

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