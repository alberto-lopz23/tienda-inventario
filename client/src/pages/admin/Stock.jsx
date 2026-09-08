import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const fmtDate = (iso) => (iso ? iso.replace('T', ' ').slice(0, 16) : '');

export default function Stock() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('');
  const [adjusting, setAdjusting] = useState(null);
  const [form, setForm] = useState({ type: 'entrada', quantity: '', note: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadAll() {
    const [m, p] = await Promise.all([api('/admin/movements'), api('/products/admin/list')]);
    setMovements(m);
    setProducts(p);
  }

  async function loadMovements() {
    setMovements(await api(`/admin/movements${filter ? `?productId=${filter}` : ''}`));
  }

  useEffect(() => {
    loadAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(loadMovements, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function openAdjust(p) {
    setAdjusting(p);
    setForm({ type: 'entrada', quantity: '', note: '' });
    setError('');
  }

  async function saveAdjust(e) {
    e.preventDefault();
    const quantity = Math.round(Number(form.quantity));
    if (!(quantity > 0)) {
      setError('Ingresa una cantidad válida');
      return;
    }
    await api(`/products/admin/${adjusting.id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ quantity, type: form.type, note: form.note })
    });
    setNotice(`Stock de "${adjusting.name}" actualizado ✓`);
    setAdjusting(null);
    await loadAll();
    await loadMovements();
  }

  return (
    <>
      <div className="toolbar">
        <h1 className="admin-title" style={{ margin: 0, flex: 1 }}>
          Stock y movimientos
        </h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">Todos los productos</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.stock})
            </option>
          ))}
        </select>
      </div>

      {notice && <div className="alert alert-success" style={{ marginBottom: 12 }}>{notice}</div>}

      <div className="card-panel">
        <h3 style={{ marginTop: 0 }}>Movimientos recientes</h3>
        {movements.length === 0 ? (
          <div className="empty-state">Aún no hay movimientos.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td data-label="Fecha">{fmtDate(m.created_at)}</td>
                  <td data-label="Producto">{m.product_name}</td>
                  <td data-label="Tipo">
                    <span className={`badge ${m.type === 'entrada' || m.type === 'ajuste' ? 'badge-confirmado' : 'badge-cancelado'}`}>
                      {m.type}
                    </span>
                  </td>
                  <td data-label="Cantidad" style={{ color: m.quantity >= 0 ? 'var(--primary-dark)' : 'var(--danger)', fontWeight: 700 }}>
                    {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td data-label="Nota" className="muted">{m.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adjusting && (
        <div className="modal-overlay" onClick={() => setAdjusting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ajustar stock: {adjusting.name}</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Stock actual: <strong>{adjusting.stock} unidades</strong>
            </p>
            <form onSubmit={saveAdjust} className="form-grid">
              <div className="form-field">
                <span>Tipo de movimiento</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="entrada">Entrada (agregar)</option>
                  <option value="salida">Salida (quitar)</option>
                  <option value="ajuste">Ajuste (fijar cantidad)</option>
                </select>
              </div>
              <div className="form-field">
                <span>Cantidad</span>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Nota</span>
                <input value={form.note} placeholder="Ej: reposición, merma..." onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              {error && <div className="alert alert-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAdjusting(null)}>
                  Cancelar
                </button>
                <button className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}