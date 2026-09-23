import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { money, salePriceCents } from '../api.js';
import { useCart } from '../context/CartContext.jsx';

function sampleBg(img, setBg) {
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;
    const sw = 24;
    const sh = Math.max(1, Math.round((h / w) * sw));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;
    const corners = [0, sw - 1, (sh - 1) * sw, (sh - 1) * sw + (sw - 1)];
    let r = 0, g = 0, b = 0, a = 0;
    for (const i of corners) {
      r += data[i * 4];
      g += data[i * 4 + 1];
      b += data[i * 4 + 2];
      a += data[i * 4 + 3];
    }
    if (a < 340) return;
    setBg(`rgb(${Math.round(r / 4)}, ${Math.round(g / 4)}, ${Math.round(b / 4)})`);
  } catch {
    /* canvas tainted u otro error: se mantiene el fondo por defecto */
  }
}

function CardImage({ product }) {
  const imgRef = useRef(null);
  const [bg, setBg] = useState(null);
  return (
    <div className="card-img" style={bg ? { background: bg } : undefined}>
      {product.image ? (
        <img
          ref={imgRef}
          src={product.image}
          alt={product.name}
          className="card-img-src"
          loading="lazy"
          onLoad={() => sampleBg(imgRef.current, setBg)}
        />
      ) : (
        '🛍️'
      )}
    </div>
  );
}

export default function ProductCard({ product }) {
  const { items, add, remove } = useCart();
  const out = product.stock <= 0;
  const saleCents = salePriceCents(product.price_cents, product.discount_percent);
  const discounted = saleCents !== product.price_cents;
  const detailPath = `/producto/${product.id}`;
  const needsColor = product.has_colors && Array.isArray(product.colors) && product.colors.length > 0;
  const inCart = items.some((i) => i.product_id === product.id && !i.color_id);

  const addToCart = () => {
    if (out || needsColor) return;
    add(product, 1, null);
  };

  const removeFromCart = () => {
    remove(product.id, null);
  };

  return (
    <div className="card">
      <Link to={detailPath} className="card-img-wrap">
        <CardImage product={product} />
        {product.has_colors && product.colors && product.colors.length > 0 && (
          <div className="card-swatches">
            {product.colors.slice(0, 5).map((c) => (
              <span key={c.id} className="color-dot" title={c.name} style={{ background: c.hex || '#888' }} />
            ))}
            {product.colors.length > 5 && <span className="color-more">+{product.colors.length - 5}</span>}
          </div>
        )}
        {product.requires_installation && (
          <span className="card-install-badge">🔧 Requiere instalación</span>
        )}
      </Link>
      <div className="card-body">
        <Link to={detailPath}>
          <h3 className="card-name">{product.name}</h3>
        </Link>
        {product.description && <p className="card-desc">{product.description}</p>}
        <div className="card-price">
          {discounted && <span className="price-orig">{money(product.price_cents)}</span>}{' '}
          {money(saleCents)}
          {discounted && <span className="price-discount-badge">−{product.discount_percent}%</span>}
        </div>
        {out ? (
          <span className="stock-status stock-out">Agotado</span>
        ) : (
          <span className="stock-status stock-ok">Disponible</span>
        )}
      </div>
      <div className="card-actions">
        {needsColor ? (
          <Link to={detailPath} className="btn btn-primary btn-block">Elegir color</Link>
        ) : inCart ? (
          <button className="btn btn-success btn-block" onClick={removeFromCart}>✓ Quitar del carrito</button>
        ) : (
          <button className="btn btn-primary btn-block" disabled={out} onClick={addToCart}>Agregar al carrito</button>
        )}
        <Link to={detailPath} className="btn btn-ghost btn-block">Ver detalles</Link>
      </div>
    </div>
  );
}