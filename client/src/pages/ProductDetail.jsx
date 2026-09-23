import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money, salePriceCents, salePrice } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import Header from '../components/Header.jsx';

const SWIPE_MIN = 40;

export default function ProductDetail() {
  const { id } = useParams();
  const { items, add, updateQty, remove } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [color, setColor] = useState(null);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const images = product && Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : product && product.image
      ? [product.image]
      : [];
  const selected = color || null;
  const stock = selected ? selected.stock : product ? product.stock : 0;
  const out = stock <= 0;
  const saleCents = salePriceCents(product ? product.price_cents : 0, product ? product.discount_percent : 0);
  const discounted = saleCents !== (product ? product.price_cents : 0);

  useEffect(() => {
    let alive = true;
    api(`/products/${id}`)
      .then((p) => {
        if (!alive) return;
        setProduct(p);
        if (p.has_colors && Array.isArray(p.colors) && p.colors.length > 0) {
          setColor(p.colors[0]);
        }
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const go = (i) => {
    const n = images.length;
    if (n === 0) return;
    const next = ((i % n) + n) % n;
    setImageIndex(next);
  };

  const cartItem = product && items.find((i) => i.product_id === product.id && (i.color_id || null) === (selected?.id || null));
  const cartQty = cartItem ? cartItem.quantity : 0;

  const addToCart = () => {
    if (out) return;
    add(product, Math.min(qty, Math.max(0, stock)), selected);
  };

  const removeFromCart = () => {
    if (qty < cartQty) updateQty(product.id, selected?.id || null, qty);
    else remove(product.id, selected?.id || null);
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container" style={{ padding: '40px 16px', textAlign: 'center' }}>Cargando...</div>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Header />
        <div className="container" style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div className="alert alert-error">{error || 'Producto no encontrado'}</div>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>Volver al catalogo</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container" style={{ maxWidth: 1100, padding: '16px' }}>
        <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>Volver al catalogo</Link>
        <div className="detail-grid">
          <div className="detail-gallery">
            {images.length === 0 ? (
              <div className="detail-main-img empty">*</div>
            ) : (
              <>
                <div className="detail-main-img">
                  <div className="detail-track" style={{ width: `${images.length * 100}%`, transform: `translateX(-${imageIndex * 100}%)` }}>
                    {images.map((src, i) => (
                      <div className="detail-slide" key={i}><img src={src} alt={product.name} /></div>
                    ))}
                  </div>
                  {images.length > 1 && (
                    <>
                      <button className="carousel-btn carousel-prev" onClick={() => go(imageIndex - 1)}>p</button>
                      <button className="carousel-btn carousel-next" onClick={() => go(imageIndex + 1)}>n</button>
                      <div className="carousel-dots">
                        {images.map((_, i) => (
                          <span key={i} className={`carousel-dot ${i === imageIndex ? 'active' : ''}`} onClick={() => go(i)} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="detail-thumbs">
                    {images.map((src, i) => (
                      <button key={i} className={`detail-thumb ${i === imageIndex ? 'active' : ''}`} onClick={() => go(i)}><img src={src} alt="" /></button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="detail-info">
            <h1 className="detail-name">{product.name}</h1>
            {product.category && <div className="muted">{product.category}</div>}
            {product.description && <p>{product.description}</p>}

            <div className="detail-price">
              {discounted && <span className="price-orig">{money(product.price_cents)}</span>}{' '}
              {money(saleCents)}
              {discounted && <span className="price-discount-badge">-{product.discount_percent}%</span>}
            </div>

            {product.has_colors && Array.isArray(product.colors) && product.colors.length > 0 && (
              <div className="detail-colors">
                <div className="detail-label">Color: <strong>{selected ? selected.name : 'Elige uno'}</strong></div>
                <div className="color-swatches">
                  {product.colors.map((c) => (
                    <button
                      key={c.id}
                      className={`color-swatch-bar ${selected && selected.id === c.id ? 'active' : ''}`}
                      onClick={() => setColor({ ...c })}
                      disabled={c.stock <= 0}
                      title={c.stock <= 0 ? `${c.name} (agotado)` : c.name}
                    >
                      <span className="color-swatch-dot" style={{ background: c.hex || '#888' }} />
                      <span className="color-swatch-name">{c.name}</span>
                      {c.stock <= 0 && <span className="color-swatch-stock">Agotado</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="detail-qty">
              <span>Cantidad</span>
              <div className="qty-control">
                <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(0, stock)}
                  value={qty}
                  onChange={(e) => {
                    const v = Math.round(Number(e.target.value));
                    setQty(Number.isFinite(v) ? Math.max(1, Math.min(v, Math.max(0, stock))) : 1);
                  }}
                />
                <button className="qty-btn" disabled={stock > 0 && qty >= stock} onClick={() => setQty(qty + 1)}>+</button>
              </div>
            </div>

{out ? (
              <span className="stock-status stock-out" style={{ display: 'block', textAlign: 'center' }}>Agotado</span>
            ) : cartQty > 0 && qty <= cartQty ? (
              <button className="btn btn-success btn-block" onClick={removeFromCart}>Quitar del carrito</button>
            ) : (
              <button className="btn btn-primary btn-block" onClick={addToCart}>Agregar al carrito</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
