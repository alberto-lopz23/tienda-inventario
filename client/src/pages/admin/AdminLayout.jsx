import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';

export default function AdminLayout() {
  const token = localStorage.getItem('admin_token');
  const navigate = useNavigate();

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