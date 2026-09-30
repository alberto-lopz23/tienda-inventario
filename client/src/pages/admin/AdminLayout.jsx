import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';

// Ping cada 4 minutos para que la función serverless y Neon no entren en modo
// reposo: una instancia fría es la causa raíz de los 401 espurios.
const KEEPALIVE_MS = 4 * 60 * 1000;

export default function AdminLayout() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setToken(localStorage.getItem('admin_token'));
    window.addEventListener('admin-session-cleared', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('admin-session-cleared', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      api('/shop').catch(() => {});
    };
    const timer = setInterval(ping, KEEPALIVE_MS);
    document.addEventListener('visibilitychange', ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', ping);
    };
  }, [token]);

  async function logout() {
    try {
      await api('/admin/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_shop');
    navigate('/admin/login');
  }

  if (!token) return <Navigate to="/admin/login" replace />;

  const links = [
    { to: '/admin', label: '📊 Resumen' },
    { to: '/admin/productos', label: '📦 Productos' },
    { to: '/admin/stock', label: '📈 Stock y movimientos' },
    { to: '/admin/pedidos', label: '🧾 Pedidos' },
    { to: '/admin/config', label: '⚙️ Configuración' }
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <span className="logo">Admin</span>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/admin'} className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            {l.label}
          </NavLink>
        ))}
        <span style={{ flex: 1 }} />
        <Link to="/" className="admin-link">
          🌐 Ver tienda
        </Link>
        <button className="admin-link" onClick={logout} style={{ background: 'none', border: 'none', textAlign: 'left' }}>
          🚪 Salir
        </button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
