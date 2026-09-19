import { Link } from 'react-router-dom';
import { money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';

export default function CartDrawer() {
  const { items, updateQty, remove, toggleInstallation, totalCents, count, open, setOpen } = useCart();
  const hasInstallItems = items.some((i) => i.requires_installation);

  return (
    <>
      {open && <div className="drawer-overlay" onClick={() => setOpen(false)} />}
      <aside className="drawer" style={{ display: open ? 'flex' : 'none' }}>
        <div className="drawer-header">
          <strong>Tu carrito ({count})</strong>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
            ✕ Cerrar
          </button>
        </div>
        <div className="drawer-body">
          {hasInstallItems && (
            <div className="drawer-install-note">
              🔧 Hay productos que requieren instalación. Agrégala desde el producto para calcular el total.
            </div>
          )}
          {items.length === 0 && (
            <div className="drawer-empty">
              <div style={{ fontSize: 40 }}>🛒</div>
              <p>Tu carrito está vacío</p>
              <Link to="/" className="btn btn-primary" onClick={() => setOpen(false)}>
                Ver catálogo
              </Link>
            </div>
          )}
          {items.map((item) => {
            const itemCents = item.price_cents * item.quantity;
            const installCents = item.with_installation ? item.installation_price_cents * item.quantity : 0;
            return (
              <div
                className={`cart-item ${item.requires_installation ? 'cart-item-install' : ''}`}
                key={item.product_id}
              >
                <div className="cart-item-img">
                  {item.image ? <img src={item.image} alt="" /> : '🛍️'}
                </div>
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">{money(item.price_cents)} c/u</div>
                  <div className="qty-control">
                    <button className="qty-btn" onClick={() => updateQty(item.product_id, item.quantity - 1)}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button className="qty-btn" disabled={item.stock > 0 && item.quantity >= item.stock} onClick={() => updateQty(item.product_id, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                  {item.requires_installation && (
                    <button
                      className={`install-toggle ${item.with_installation ? 'on' : ''}`}
                      onClick={() => toggleInstallation(item.product_id)}
                      title={`Costo de instalación: ${money(item.installation_price_cents)} por unidad`}
                    >
                      {item.with_installation ? '✓' : '+'} Instalación
                      <span className="install-price">({money(item.installation_price_cents)} c/u)</span>
                    </button>
                  )}
                </div>
                <div className="cart-item-total">
                  <strong>{money(itemCents + installCents)}</strong>
                  {item.with_installation && <span className="cart-item-price">incl. instalación</span>}
                </div>
                <button className="cart-remove" onClick={() => remove(item.product_id)} title="Quitar">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        {items.length > 0 && (
          <div className="drawer-footer">
            <div className="total-row">
              <span>Total</span>
              <span>{money(totalCents)}</span>
            </div>
            <p className="drawer-note">El pedido se envía por WhatsApp y el stock se descuenta al confirmar.</p>
            <Link to="/checkout" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
              Finalizar compra
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}