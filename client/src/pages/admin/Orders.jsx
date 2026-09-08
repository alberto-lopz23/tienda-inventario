import { useEffect, useState } from 'react';
import { api, money } from '../../api.js';

const fmtDate = (iso) => (iso ? iso.replace('T', ' ').slice(0, 16) : '');

const STATUS_COLOR = {
  pendiente: 'badge-pendiente',
  confirmado: 'badge-confirmado',
  entregado: 'badge-entregado',
  cancelado: 'badge-cancelado'
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [notice, setNotice] = useState('');

  async function load() {
    setOrders(await api(`/admin/orders${filter ? `?status=${filter}` : ''}`));
  }

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function setStatus(o, status) {
    if (status === 'cancelado' && !confirm(`¿Cancelar el pedido? El stock será devuelto al inventario.`)) return;
    await api(`/orders/${o.id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    setNotice(`Pedido #${o.id} → ${status} ✓`);
    await load();
  }

  return (
    <>
      <div className="toolbar">
        <h1 className="admin-title" style={{ margin: 0, flex: 1 }}>
          Pedidos
        </h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="confirmado">Confirmados</option>
          <option value="entregado">Entregados</option>
          <option value="cancelado">Cancelados</option>
        </select>
      </div>

      {notice && <div className="alert alert-success" style={{ marginBottom: 12 }}>{notice}</div>}

      {orders.length === 0 ? (
        <div className="empty-state">No hay pedidos{filter ? ' con este estado' : ''}.</div>
      ) : (
        <div className="card-panel" style={{ margin: 0 }}>
          {orders.map((o) => (
            <div key={o.id} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <strong>#{o.id}</strong>
                <span className={`badge ${STATUS_COLOR[o.status] || ''}`}>{o.status}</span>
                <span className="muted">{fmtDate(o.created_at)}</span>
                <span className="muted">👤 {o.customer_name}</span>
                {o.phone && <span className="muted">📞 {o.phone}</span>}
                <span style={{ flex: 1 }} />
                <strong>{money(o.total_cents)}</strong>
                <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                  {expanded === o.id ? 'Ocultar' : 'Detalles'}
                </button>
              </div>

              {expanded === o.id && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}>
                  <table className="table">
                    <tbody>
                      {o.items.map((it, idx) => (
                        <tr key={idx}>
                          <td data-label="Cant.">{it.quantity}×</td>
                          <td data-label="Producto">
                            {it.name}
                            {it.with_installation && (
                              <span className="muted" style={{ fontSize: 12 }}>
                                {' '}
                                🛠 con instalación (+{money(it.installation_price_cents * it.quantity)})
                              </span>
                            )}
                          </td>
                          <td data-label="Subtotal" style={{ textAlign: 'right' }}>{money(it.price_cents * it.quantity + (it.with_installation ? it.installation_price_cents * it.quantity : 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {o.note && <p className="muted">📝 {o.note}</p>}
                  {o.phone && (
                    <a href={`https://wa.me/${o.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                      💬 Contactar al cliente
                    </a>
                  )}
                </div>
              )}

              {o.status === 'pendiente' && (
                <div className="row-actions" style={{ marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setStatus(o, 'confirmado')}>
                    Confirmar pedido
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setStatus(o, 'cancelado')}>
                    Cancelar
                  </button>
                </div>
              )}
              {o.status === 'confirmado' && (
                <button className="btn btn-primary btn-sm mt-8" onClick={() => setStatus(o, 'entregado')}>
                  Marcar entregado
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}