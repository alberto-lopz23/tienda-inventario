import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import CartDrawer from './CartDrawer.jsx';

export default function Header() {
  const { count, setOpen } = useCart();
  const [shopName, setShopName] = useState('Evolution Garage');

  useEffect(() => {
    api('/shop').then((d) => d && setShopName(d.shop_name)).catch(() => {});
  }, []);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          <img src="/logoHeader.jpeg" alt={shopName} />
        </Link>
        <span className="header-spacer" />
        <Link to="/admin/login" className="btn btn-ghost btn-sm">
          Admin
        </Link>
        <button className={`btn ${count > 0 ? 'btn-success' : 'btn-primary'} cart-button`} onClick={() => setOpen(true)}>
          🛒 Carrito
          {count > 0 && <span className="cart-badge">{count}</span>}
        </button>
      </div>
      <CartDrawer />
    </header>
  );
}