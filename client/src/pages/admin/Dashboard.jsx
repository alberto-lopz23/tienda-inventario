import { useEffect, useState } from 'react';
import { api, money } from '../../api.js';

const fmtDate = (iso) => (iso ? iso.replace('T', ' ').slice(0, 16) : '');
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/movements/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <div className="empty-state">Cargando...</div>;

  return (
    <>
      <h1 className="admin-title">Resumen de la tienda</h1>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-value">{stats.total_products}</div>
          <div className="stat-label">Productos activos</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.total_units}</div>
          <div className="stat-label">Unidades en stock</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: stats.low_stock_count ? 'var(--warning)' : 'inherit' }}>
            {stats.low_stock_count}
          </div>
          <div className="stat-label">Con stock bajo o agotado</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.pending_orders}</div>
          <div className="stat-label">Pedidos pendientes</div>
        </div>
        <div className="stat">
          <div className="stat-value">{money(stats.today_sales_cents)}</div>
          <div className="stat-label">Ventas de hoy</div>
        </div>
      </div>

      <div className="card-panel">
        <h3 style={{ marginTop: 0 }}>⚠️ Stock bajo o agotado</h3>
        {stats.low_stock_list.length === 0 ? (
          <p className="muted">Todo en orden, no hay productos por reponer.</p>
        ) : (
          <div className="table">
            {stats.low_stock_list.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{p.name}</span>
                <span className={`badge ${p.stock <= 0 ? 'badge-cancelado' : 'badge-pendiente'}`}>
                  {p.stock <= 0 ? 'Agotado' : `Quedan ${p.stock}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-panel">
        <h3 style={{ marginTop: 0 }}>Últimos movimientos de stock</h3>
        {stats.recent_movements.length === 0 ? (
          <p className="muted">Sin movimientos aún.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_movements.map((m) => (
                <tr key={m.id}>
                  <td data-label="Fecha">{fmtDate(m.created_at)}</td>
                  <td data-label="Producto">{m.product_name}</td>
                  <td data-label="Tipo">{m.type}</td>
                  <td data-label="Cantidad" style={{ color: m.quantity >= 0 ? 'var(--primary-dark)' : 'var(--danger)', fontWeight: 600 }}>
                    {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}