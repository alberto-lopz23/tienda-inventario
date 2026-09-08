import { useEffect, useState } from 'react';
import { api } from '../../api.js';

export default function Settings() {
  const [shopName, setShopName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/config').then((d) => {
      setShopName(d.shop_name);
      setWhatsapp(d.whatsapp_number);
    }).catch(() => {});
  }, []);

  async function saveGeneral(e) {
    e.preventDefault();
    setError('');
    const d = await api('/config', {
      method: 'PUT',
      body: JSON.stringify({ shop_name: shopName, whatsapp_number: whatsapp })
    });
    setShopName(d.shop_name);
    setWhatsapp(d.whatsapp_number);
    localStorage.setItem('admin_shop', d.shop_name);
    setNotice('Configuración guardada ✓');
  }

  async function savePassword(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    await api('/config/password', { method: 'POST', body: JSON.stringify({ password: newPassword }) });
    setNewPassword('');
    setNotice('Contraseña cambiada ✓');
  }

  return (
    <>
      <h1 className="admin-title">Configuración</h1>

      {notice && <div className="alert alert-success" style={{ marginBottom: 12 }}>{notice}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      <form className="card-panel" onSubmit={saveGeneral}>
        <h3 style={{ marginTop: 0 }}>Datos de la tienda</h3>
        <div className="form-grid">
          <div className="form-field">
            <span>Nombre de la tienda</span>
            <input value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>
          <div className="form-field">
            <span>Número de WhatsApp (con código de país, ej: 5215512345678)</span>
            <input value={whatsapp} placeholder="521..." onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary mt-8">Guardar</button>
      </form>

      <form className="card-panel" onSubmit={savePassword}>
        <h3 style={{ marginTop: 0 }}>Cambiar contraseña</h3>
        <div className="form-grid">
          <div className="form-field">
            <span>Nueva contraseña</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 4 caracteres"
            />
          </div>
        </div>
        <button className="btn btn-primary mt-8">Cambiar contraseña</button>
      </form>

      <div className="card-panel">
        <h3 style={{ marginTop: 0 }}>Instrucciones importantes</h3>
        <ul className="muted" style={{ lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Configura tu número de WhatsApp para que los clientes puedan enviar pedidos.</li>
          <li>Cuando un cliente confirma su carrito, el pedido se registra y el stock se descuenta automáticamente.</li>
          <li>Si cancelas un pedido en la pestaña "Pedidos", el stock se devuelve.</li>
          <li>Los productos con stock 0 se muestran como "Agotado" y no se pueden comprar.</li>
        </ul>
      </div>
    </>
  );
}