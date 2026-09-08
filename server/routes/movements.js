import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, asyncHandler } from '../middleware.js';

const router = Router();

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { productId } = req.query;
    let sql = `SELECT m.*, p.name AS product_name
               FROM movements m JOIN products p ON p.id = m.product_id`;
    const params = [];
    if (productId) {
      sql += ' WHERE m.product_id = ?';
      params.push(productId);
    }
    sql += ' ORDER BY m.created_at DESC, m.id DESC LIMIT 500';
    res.json(await db.all(sql, params));
  })
);

router.get(
  '/stats',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const totalProducts = await db.get('SELECT COUNT(*)::int AS c, COALESCE(SUM(stock), 0)::int AS s FROM products');
    const lowStock = await db.get(
      'SELECT COUNT(*)::int AS c FROM products WHERE active = 1 AND stock <= low_stock_threshold'
    );
    const pendingOrders = await db.get("SELECT COUNT(*)::int AS c FROM orders WHERE status = 'pendiente'");
    const todaySales = await db.get(
      "SELECT COALESCE(SUM(total_cents), 0)::int AS s FROM orders WHERE status != 'cancelado' AND created_at::date = CURRENT_DATE"
    );
    const recentMovements = await db.all(`SELECT m.*, p.name AS product_name FROM movements m
              JOIN products p ON p.id = m.product_id ORDER BY m.created_at DESC, m.id DESC LIMIT 8`);
    const lowStockList = await db.all('SELECT * FROM products WHERE active = 1 AND stock <= low_stock_threshold ORDER BY stock');

    res.json({
      total_products: totalProducts.c,
      total_units: totalProducts.s,
      low_stock_count: lowStock.c,
      pending_orders: pendingOrders.c,
      today_sales_cents: todaySales.s,
      low_stock_list: lowStockList,
      recent_movements: recentMovements
    });
  })
);

export default router;