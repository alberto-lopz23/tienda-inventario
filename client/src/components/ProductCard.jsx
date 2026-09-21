import { useRef, useState } from 'react';
import { money } from '../api.js';
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
  const { add, remove, items } = useCart();
  const out = product.stock <= 0;
  const low = !out && product.stock <= product.low_stock_threshold;
  const inCart = items.some((i) => i.product_id === product.id);

  return (
    <div className="card">
      <CardImage product={product} />
      <div className="card-body">
        <h3 className="card-name">{product.name}</h3>
        {product.description && <p className="card-desc">{product.description}</p>}
        <div className="card-price">{money(product.price_cents)}</div>
        {product.requires_installation && (
          <span className="install-tag">🛠 Requiere instalación</span>
        )}
        {out ? (
          <span className="stock-status stock-out">Agotado</span>
        ) : low ? (
          <span className="stock-status stock-low">Quedan {product.stock}</span>
        ) : (
          <span className="stock-status stock-ok">Disponible</span>
        )}
        {inCart ? (
          <button className="btn btn-success btn-block" onClick={() => remove(product.id)}>
            ✓ Quitar del carrito
          </button>
        ) : (
          <button className="btn btn-primary btn-block" disabled={out} onClick={() => add(product)}>
            Agregar al carrito
          </button>
        )}
      </div>
    </div>
  );
}