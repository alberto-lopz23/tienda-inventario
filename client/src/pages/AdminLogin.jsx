import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_shop', data.shop_name);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Panel de administración</h2>
        <p className="muted">Ingresa la contraseña para administrar tu tienda.</p>
        <div className="form-field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        {error && <div className="alert alert-error mt-8">{error}</div>}
        <button className="btn btn-primary btn-block mt-8" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}