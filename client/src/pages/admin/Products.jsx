import { useEffect, useRef, useState } from 'react';
import { api, money } from '../../api.js';

const BLANK_FORM = {
  name: '',
  description: '',
  price: '',
  category: '',
  categoryMode: 'existing',
  image: '',
  stock: '',
  low_stock_threshold: 5,
  active: true,
  requires_installation: false,
  installation_price: ''
};

const emptyForm = () => ({ ...BLANK_FORM });

async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      let { width, height } = img;
      if (width <= MAX && height <= MAX) return resolve(null);
      const scale = Math.min(1, MAX / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : null),
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [installFilter, setInstallFilter] = useState('all');
  const fileRef = useRef(null);

  async function load() {
    setProducts(await api('/products/admin/list'));
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  function openNew() {
    setForm(emptyForm());
    setEditing(null);
    setShow(true);
    setError('');
  }

  function openEdit(p) {
    setForm({
      name: p.name,
      description: p.description,
      price: (p.price_cents / 100).toFixed(2),
      category: p.category,
      image: p.image,
      stock: String(p.stock),
      low_stock_threshold: p.low_stock_threshold,
      active: p.active,
      requires_installation: p.requires_installation,
      installation_price: p.installation_price_cents ? (p.installation_price_cents / 100).toFixed(2) : '',
      categoryMode: 'existing'
    });
    setEditing(p);
    setShow(true);
    setError('');
  }

  function closeModal() {
    setEditing(null);
    setForm(emptyForm());
    setShow(false);
  }

  async function uploadImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setError('');
      setNotice('');
      setUploading(true);
      let upload = null;
      if (file.type.startsWith('image/')) {
        upload = await compressImage(file);
      }
      const fd = new FormData();
      fd.append('image', upload || file);
      const data = await api('/admin/upload', { method: 'POST', body: fd });
      setForm((f) => ({ ...f, image: data.url }));
      setNotice('Imagen subida ✓');
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const price_cents = Math.round(parseFloat(form.price) * 100);
      if (!form.name.trim()) throw new Error('Escribe el nombre del producto');
      if (!(price_cents >= 0)) throw new Error('Precio inválido');
      const installation_price_cents = form.requires_installation
        ? Math.round(parseFloat(form.installation_price || '0') * 100)
        : 0;
      if (form.requires_installation && !(installation_price_cents > 0)) {
        throw new Error('Indica el costo de instalación');
      }
      const body = {
        name: form.name.trim(),
        description: form.description,
        price_cents,
        category: form.category.trim(),
        image: form.image,
        stock: Math.round(Number(form.stock) || 0),
        low_stock_threshold: Math.round(Number(form.low_stock_threshold) || 0),
        active: form.active,
        requires_installation: form.requires_installation,
        installation_price_cents
      };
      if (editing) {
        await api(`/products/admin/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/products/admin', { method: 'POST', body: JSON.stringify(body) });
      }
      setNotice(editing ? 'Producto actualizado ✓' : 'Producto creado ✓');
      closeModal();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p) {
    if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    await api(`/products/admin/${p.id}`, { method: 'DELETE' });
    setNotice('Producto eliminado');
    await load();
  }

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.category || '').toLowerCase().includes(q)) return false;
    if (cat && p.category !== cat) return false;
    if (stockFilter === 'in' && p.stock <= 0) return false;
    if (stockFilter === 'low' && !(p.stock > 0 && p.stock <= p.low_stock_threshold)) return false;
    if (stockFilter === 'out' && p.stock > 0) return false;
    if (installFilter === 'yes' && !p.requires_installation) return false;
    if (installFilter === 'no' && p.requires_installation) return false;
    return true;
  });

  return (
    <>
      <div className="toolbar">
        <h1 className="admin-title" style={{ margin: 0, flex: 1 }}>
          Productos
        </h1>
        <button className="btn btn-primary" onClick={openNew}>
          + Nuevo producto
        </button>
      </div>

      <div className="filters">
        <input
          className="filters-search"
          type="text"
          placeholder="Buscar por nombre o categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
          <option value="all">Todo el stock</option>
          <option value="in">Con stock</option>
          <option value="low">Stock bajo</option>
          <option value="out">Agotados</option>
        </select>
        <select value={installFilter} onChange={(e) => setInstallFilter(e.target.value)}>
          <option value="all">Todos (instalación)</option>
          <option value="yes">Requieren instalación</option>
          <option value="no">Sin instalación</option>
        </select>
        {(search || cat || stockFilter !== 'all' || installFilter !== 'all') && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearch('');
              setCat('');
              setStockFilter('all');
              setInstallFilter('all');
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {notice && <div className="alert alert-success" style={{ marginBottom: 12 }}>{notice}</div>}

      <div className="card-panel" style={{ margin: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">No hay productos que coincidan con los filtros.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Instalación</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td data-label="Producto">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="cart-item-img">{p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : '🛍️'}</div>
                      <div>
                        <strong>{p.name}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>{p.description?.slice(0, 40)}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Categoría">{p.category || '—'}</td>
                  <td data-label="Precio">{money(p.price_cents)}</td>
                  <td data-label="Stock">
                    <span className={`badge ${p.stock <= 0 ? 'badge-cancelado' : p.stock <= p.low_stock_threshold ? 'badge-pendiente' : 'badge-confirmado'}`}>
                      {p.stock <= 0 ? 'Agotado' : `${p.stock} uds`}
                    </span>
                  </td>
                  <td data-label="Instalación">
                    {p.requires_installation ? `Sí +${money(p.installation_price_cents)}` : '—'}
                  </td>
                  <td data-label="Estado">{p.active ? 'Activo' : 'Oculto'}</td>
                  <td data-label="Acciones">
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                        Editar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {show && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
            <form onSubmit={save} className="form-grid" style={{ gridColumn: '1 / -1' }}>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Nombre *</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Descripción</span>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-field">
                <span>Precio (/100)</span>
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
<div className="form-field">
                  <span>Categoría</span>
                  {form.categoryMode === 'new' ? (
                    <input
                      value={form.category}
                      placeholder="Escribe la nueva categoría..."
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      autoFocus
                    />
                  ) : (
                    <select
                      value={[...new Set([...categories, form.category].filter(Boolean))].includes(form.category) ? form.category : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__new__') setForm({ ...form, categoryMode: 'new', category: '' });
                        else setForm({ ...form, categoryMode: 'existing', category: v });
                      }}
                    >
                      <option value="">Sin categoría</option>
                      {[...new Set([...categories, form.category].filter(Boolean))].sort().map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__new__">➕ Nueva categoría...</option>
                    </select>
                  )}
                </div>
              <div className="form-field">
                <span>Stock inicial / actual</span>
                <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="form-field">
                <span>Aviso de stock bajo si hay ≤</span>
                <input type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Imagen</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input value={form.image} placeholder="URL de la imagen" onChange={(e) => setForm({ ...form, image: e.target.value })} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} disabled={uploading}>
                    {uploading ? 'Subiendo...' : 'Subir archivo'}
                  </button>
                  {form.image && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setForm({ ...form, image: '' })} disabled={uploading}>
                      Quitar imagen
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadImage} />
                </div>
                {form.image && (
                  <div style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
                    <img src={form.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
              <label className="form-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.requires_installation} onChange={(e) => setForm({ ...form, requires_installation: e.target.checked })} style={{ width: 'auto' }} />
                Requiere instalación (el cliente elegirá si la quiere al pagar)
              </label>
              {form.requires_installation && (
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Costo de instalación (/100)</span>
                  <input type="number" step="0.01" min="0" value={form.installation_price} placeholder="Ej: 450" onChange={(e) => setForm({ ...form, installation_price: e.target.value })} />
                </div>
              )}
              <label className="form-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 'auto' }} />
                Visible en la tienda
              </label>
              {error && <div className="alert alert-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Cancelar
                </button>
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}