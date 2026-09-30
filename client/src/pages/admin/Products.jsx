import { useEffect, useRef, useState } from 'react';
import { api, money, salePrice, centsToInput, inputToCents } from '../../api.js';

const BLANK_FORM = {
  name: '',
  description: '',
  price: '',
  category: '',
  categoryMode: 'existing',
  image: '',
  images: [],
  stock: '',
  low_stock_threshold: 5,
  active: true,
  requires_installation: false,
  installation_price: '',
  cost: '',
  discount: '',
  has_colors: false,
  colors: []
};

const emptyForm = () => ({ ...BLANK_FORM, images: [], colors: [] });

const NEW_CATEGORY = '__new__';

let colorSeq = 0;
const newColorRow = (name = '', priceCents = 0) => ({
  uid: `c${++colorSeq}`,
  id: undefined,
  name,
  hex: '#888888',
  stock: '0',
  price: centsToInput(priceCents)
});

const normalizeCat = (s) =>
  String(s || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const clampMoneyField = (v) => {
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? String(n) : '';
};

const clampPercentField = (v) => {
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return '';
  const c = Math.max(0, Math.min(100, n));
  return String(c);
};

function parseHexField(v, fallback) {
  const s = String(v || '').trim();
  if (/^#?[0-9a-f]{3,8}$/i.test(s)) return s;
  return fallback;
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      const MAX_BYTES = 1024 * 1024;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.min(1, MAX / Math.max(iw, ih));
      let w = Math.max(1, Math.round(iw * scale));
      let h = Math.max(1, Math.round(ih * scale));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const exportAt = (quality) =>
        new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
      const draw = () => {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
      };
      draw();
      (async () => {
        let quality = 0.85;
        let blob = await exportAt(quality);
        while (blob && blob.size > MAX_BYTES && quality > 0.4) {
          quality = Math.max(0.4, quality - 0.15);
          blob = await exportAt(quality);
        }
        while (blob && blob.size > MAX_BYTES && Math.min(w, h) > 400) {
          w = Math.max(1, Math.round(w / 2));
          h = Math.max(1, Math.round(h / 2));
          draw();
          blob = await exportAt(quality);
        }
        resolve(blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : null);
      })();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

const clampStock = (n) => Math.max(0, Math.round(Number(n) || 0));

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
  const [categories, setCategories] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [p, c] = await Promise.all([
      api('/products/admin/list'),
      api('/products/categories')
    ]);
    setProducts(p);
    setCategories(c);
  }

  async function remove(p) {
    if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    await api(`/products/admin/${p.id}`, { method: 'DELETE' });
    setNotice('Producto eliminado');
    await load();
  }

  function openNew() {
    setForm(emptyForm());
    setEditing(null);
    setShow(true);
    setError('');
  }

  function openEdit(p) {
    setForm({
      ...emptyForm(),
      name: p.name,
      description: p.description || '',
      price: (p.price_cents / 100).toFixed(2),
      cost: p.cost_cents ? (p.cost_cents / 100).toFixed(2) : '',
      discount: p.discount_percent ? String(p.discount_percent) : '',
      category: p.category,
      categoryMode: 'existing',
      images: p.images && p.images.length ? [...p.images] : p.image ? [p.image] : [],
      image: p.image || (p.images && p.images[0]) || '',
      stock: String(p.stock),
      low_stock_threshold: p.low_stock_threshold,
      active: p.active,
      requires_installation: p.requires_installation,
      installation_price: p.installation_price_cents ? (p.installation_price_cents / 100).toFixed(2) : '',
      has_colors: p.has_colors,
      colors: Array.isArray(p.colors)
        ? p.colors.map((c) => ({
            ...newColorRow(c.name, c.price_cents),
            id: c.id,
            hex: c.hex || '',
            stock: String(c.stock)
          }))
        : []
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

  async function uploadImages(e) {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      e.target.value = '';
      return;
    }
    e.target.value = '';
    setError('');
    try {
      setUploading(true);
      const urls = [];
      for (const file of files) {
        const fd = new FormData();
        const toSend = (await compressImage(file)) || file;
        fd.append('image', toSend, toSend.name || 'photo.jpg');
        const data = await api('/admin/upload', { method: 'POST', body: fd });
        if (data.url) urls.push(data.url);
      }
      if (urls.length === 0) throw new Error('No se pudo subir la imagen');
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
      if (urls.length === 1) setNotice('Imagen subida ✓');
      else setNotice(`${urls.length} imágenes subidas ✓`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(i) {
    setForm((f) => ({ ...f, images: f.images.filter((_, x) => x !== i) }));
  }

  function moveImage(from, to) {
    setForm((f) => {
      const imgs = [...f.images];
      const [m] = imgs.splice(from, 1);
      imgs.splice(to, 0, m);
      return { ...f, images: imgs };
    });
  }

  function addColorRow(preset) {
    setForm((f) => ({
      ...f,
      colors: [...f.colors, typeof preset === 'string' ? newColorRow(preset) : newColorRow()]
    }));
  }

  function updateColor(idx, patch) {
    setForm((f) => ({ ...f, colors: f.colors.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));
  }

  function removeColor(idx) {
    setForm((f) => ({ ...f, colors: f.colors.filter((_, i) => i !== idx) }));
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const name = String(form.name || '').trim();
      if (!name) throw new Error('Escribe el nombre del producto');
      const price = Math.round(Number(form.price) * 100);
      if (!(price >= 0)) throw new Error('Precio de venta inválido');
      const cost = Math.round(Number(form.cost) * 100);
      if (!(cost >= 0)) throw new Error('Precio de compra inválido');
      const discount = Math.round(Number(form.discount) || 0);
      if (discount < 0 || discount > 100) throw new Error('Descuento inválido (0–100%)');

      let category = String(form.category || '').trim();
      if (form.categoryMode === 'new') {
        if (!category) throw new Error('Escribe el nombre de la nueva categoría');
        const dup = allCats.find((c) => normalizeCat(c) === normalizeCat(category));
        if (dup) throw new Error(`La categoría "${dup}" ya existe, selecciónala en la lista`);
        category = category.charAt(0).toUpperCase() + category.slice(1);
      }

      if (form.has_colors) {
        const sinNombre = form.colors.findIndex((c) => !String(c.name || '').trim());
        if (sinNombre !== -1) {
          throw new Error(`El color de la fila ${sinNombre + 1} no tiene nombre. Ponle un nombre o quítalo con ✕.`);
        }
      }
      const colors = form.has_colors
        ? form.colors.map((c) => ({
            id: c.id,
            name: String(c.name || '').trim(),
            hex: parseHexField(c.hex, '#888888'),
            stock: clampStock(c.stock),
            price_cents: inputToCents(c.price)
          }))
        : [];
      if (form.has_colors && colors.length === 0) {
        throw new Error('Para usar colores agrega al menos un color');
      }
      for (const c of colors) {
        if (c.stock > 0 && !/^#[0-9a-f]{3,8}$/i.test(c.hex)) {
          // hex inválido se normalizó al default de gris
        }
        if (!/^#[0-9a-f]{3,8}$/i.test(c.hex)) {
          throw new Error(`El color "${c.name}" tiene un código inválido`);
        }
      }

      const images = form.images && form.images.length ? form.images : [];
      const stock = form.has_colors
        ? colors.reduce((s, c) => s + c.stock, 0)
        : clampStock(form.stock);
      const has_colors_stock = form.has_colors ? colors.reduce((s, c) => s + c.stock, 0) : 0;
      const bodyStock = form.has_colors ? has_colors_stock : clampStock(form.stock);
      const body = {
        name,
        description: String(form.description || ''),
        price_cents: price,
        cost_cents: cost,
        discount_percent: discount,
        category,
        image: images[0] || '',
        images,
        stock: bodyStock,
        low_stock_threshold: Math.round(Number(form.low_stock_threshold) || 0),
        active: form.active,
        requires_installation: form.requires_installation,
        installation_price_cents: form.requires_installation
          ? Math.round(Number(form.installation_price) * 100)
          : 0,
        has_colors: form.has_colors,
        colors
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

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.category || '').toLowerCase().includes(q)) return false;
    if (cat && p.category !== cat) return false;
    return true;
  });
  const allCats = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();

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
          {allCats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {notice && <div className="alert alert-success" style={{ marginBottom: 12 }}>{notice}</div>}

      {products.length === 0 ? (
        <div className="card-panel" style={{ margin: 0 }}>
          <div className="empty-state">Crea tu primer producto con el botón "+ Nuevo producto".</div>
        </div>
      ) : (
        <div className="card-panel" style={{ margin: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Costo</th>
                <th>Stock</th>
                <th>Instalación</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const final = salePrice(p.price_cents, p.discount_percent);
                const discounted = final !== p.price_cents;
                return (
                  <tr key={p.id}>
                    <td data-label="Producto">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="cart-item-img">
                          {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : '🛍️'}
                        </div>
                        <div>
                          <strong>{p.name}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>{p.description?.slice(0, 40)}</div>
                          {p.images && p.images.length > 1 && (
                            <div className="muted" style={{ fontSize: 12 }}>🖼 {p.images.length} fotos</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td data-label="Categoría">{p.category || '—'}</td>
                    <td data-label="Precio">
                      <div className={discounted ? 'price-discount' : ''}>
                        {money(final)}
                        {discounted && <span className="price-orig">{money(p.price_cents)}</span>}
                      </div>
                    </td>
                    <td data-label="Costo">{money(p.cost_cents || 0)}</td>
                    <td data-label="Stock">
                      <span className={`badge ${p.stock <= 0 ? 'badge-cancelado' : p.stock <= p.low_stock_threshold ? 'badge-pendiente' : 'badge-confirmado'}`}>
                        {p.stock <= 0 ? 'Agotado' : `${p.stock} uds`}
                      </span>
                      {p.has_colors && p.colors && p.colors.length > 0 && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {p.colors.map((c) => (
                            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 8 }}>
                              <span className="color-dot-swatch" style={{ background: c.hex || '#888' }} />
                              {c.name}: {c.stock}
                              {c.price_cents > 0 && ` · ${money(c.price_cents)}`}
                            </span>
                          ))}
                        </div>
                      )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {show && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
            <form onSubmit={save} className="form-grid">
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Nombre *</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Descripción</span>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-field">
                <span>Precio de venta /100</span>
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="form-field">
                <span>Precio de compra /100</span>
                <input type="number" step="0.01" min="0" value={form.cost} placeholder="Solo admin" onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
              <div className="form-field">
                <span>Descuento %</span>
                <input type="number" step="1" min="0" max="100" value={form.discount} onChange={(e) => setForm({ ...form, discount: clampPercentField(e.target.value) })} />
                {form.discount > 0 && form.price !== '' && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    Final: {money(Math.round(Number(form.price) * (100 - Math.round(Number(form.discount))) / 100) * 100)}
                  </div>
                )}
              </div>
              <div className="form-field">
                <span>Categoría</span>
                <select
                  value={form.categoryMode === 'new' ? NEW_CATEGORY : form.category}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === NEW_CATEGORY) setForm({ ...form, categoryMode: 'new', category: '' });
                    else setForm({ ...form, categoryMode: 'existing', category: v });
                  }}
                >
                  <option value="">Sin categoría</option>
                  {allCats.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={NEW_CATEGORY}>➕ Nueva categoría...</option>
                </select>
              </div>
              {form.categoryMode === 'new' && (
                <div className="form-field">
                  <span>Nombre de la nueva categoría</span>
                  <input
                    autoFocus
                    placeholder="Ej: Refrigeración"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
              )}

              <div className="card-panel" style={{ gridColumn: '1 / -1', padding: 14, margin: 0 }}>
                <span style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>Imágenes ({form.images.length})</span>
                {form.images.length > 0 && (
                  <div className="gallery-grid">
                    {form.images.map((u, i) => (
                      <div className="gallery-thumb" key={i}>
                        <img src={u} alt="" />
                        {i === 0 && <span className="gallery-cover">Portada</span>}
                        <button type="button" className="gallery-x" onClick={() => removeImage(i)} title="Quitar">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} disabled={uploading}>
                    {uploading ? 'Subiendo...' : '➕ Agregar imagen'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={uploadImages} />
                  <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
                    La primera es la portada. Sube varias con un solo clic.
                  </span>
                </div>
              </div>

              <label className="form-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.has_colors} onChange={(e) => setForm({ ...form, has_colors: e.target.checked, colors: e.target.checked && form.colors.length === 0 ? [newColorRow()] : form.colors })} />
                Este producto tiene colores
              </label>

              {form.has_colors && (
                <div className="card-panel" style={{ gridColumn: '1 / -1', padding: 14, margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>
                      Colores y stock {form.colors.length > 0 && `· stock total ${form.colors.reduce((s, c) => s + clampStock(c.stock), 0)}`}
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => addColorRow()}>➕ Agregar color</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => addColorRow('FIBRA')}>➕ Fibra</button>
                    </div>
                  </div>
                  {form.colors.length === 0 && (
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      Aún no hay colores. Agrega al menos uno para poder guardar el producto.
                    </div>
                  )}
                  {form.colors.map((c, idx) => (
                    <div
                      key={c.uid || c.id || idx}
                      style={{ display: 'grid', gridTemplateColumns: '44px minmax(90px,1fr) 74px 92px auto', gap: 8, alignItems: 'center', marginBottom: 8 }}
                    >
                      <input type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#888888'} onChange={(e) => updateColor(idx, { hex: e.target.value })} style={{ width: 44, padding: 2, height: 38 }} />
                      <input placeholder="Color (ej: Rojo)" value={c.name} onChange={(e) => updateColor(idx, { name: e.target.value })} />
                      <input type="number" min="0" placeholder="Stock" value={c.stock} onChange={(e) => updateColor(idx, { stock: e.target.value })} />
                      <input type="number" min="0" step="0.01" placeholder="Precio" value={c.price} onChange={(e) => updateColor(idx, { price: e.target.value })} title="Precio propio de este color. Vacío = precio del producto." />
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeColor(idx)} title="Quitar color">✕</button>
                    </div>
                  ))}
                  <div className="muted" style={{ fontSize: 12 }}>
                    El precio es opcional: si lo dejas vacío el color usa el precio del producto. La suma del stock de los
                    colores es el stock total.
                  </div>
                </div>
              )}

              <div className="form-field">
                <span>Stock inicial/actual</span>
                <input type="number" min="0" value={form.stock} disabled={form.has_colors} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                {form.has_colors && (
                  <div className="muted" style={{ fontSize: 12 }}>Stock total = suma de colores</div>
                )}
              </div>
              <div className="form-field">
                <span>Aviso de stock bajo si hay ≤</span>
                <input type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
              </div>
              <label className="form-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.requires_installation} onChange={(e) => setForm({ ...form, requires_installation: e.target.checked })} />
                Requiere instalación (el cliente elegirá si la quiere al pagar)
              </label>
              {form.requires_installation && (
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Costo de instalación /100</span>
                  <input type="number" step="0.01" min="0" value={form.installation_price} onChange={(e) => setForm({ ...form, installation_price: e.target.value })} />
                </div>
              )}
              <label className="form-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
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
