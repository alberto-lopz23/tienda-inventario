import { money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';

export default function ProductCard({ product }) {
  const { add, remove, items } = useCart();
  const out = product.stock <= 0;
  const low = !out && product.stock <= product.low_stock_threshold;
  const inCart = items.some((i) => i.product_id === product.id);

  return (
    <div className="card">
      <div className="card-img">
        {product.image ? <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🛍️'}
      </div>
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