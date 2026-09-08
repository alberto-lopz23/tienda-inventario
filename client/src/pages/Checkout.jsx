import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, whatsappLink } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import Header from '../components/Header.jsx';

export default function Checkout() {
  const { items, totalCents, clear } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api('/shop').then((d) => d && setShopPhone(d.whatsapp_number)).catch(() => {});
  }, []);

  function buildMessage(waPhone) {
    const lines = [
      `🎁 Hola, quiero hacer un pedido en Evolution Garage:`,
      '',
      '*MI PEDIDO:*',
      ...items.map((i) => {
        const itemTotal = i.price_cents * i.quantity;
        const lines2 = [`• ${i.quantity}× ${i.name} — ${money(itemTotal)}`];
        if (i.with_installation) {
          lines2.push(`   🛠 Incluye instalación (+${money(i.installation_price_cents * i.quantity)})`);
        }
        return lines2.join('\n');
      }),
      '',
      `*TOTAL: ${money(totalCents)}*`,
      ''
    ];
    if (waPhone) lines.push(`📞 Mi teléfono: ${waPhone}`);
    if (name) lines.push(`👤 Cliente: ${name}`);
    if (note) lines.push(`📝 Nota: ${note}`);
    return lines.join('\n');
  }

  async function sendWhatsApp() {
    setError('');
    if (!name.trim()) {
      setError('Escribe tu nombre');
      return;
    }
    if (phone.trim() && !/^[+\d][\d\s-]{6,}$/.test(phone.trim())) {
      setError('El teléfono parece inválido');
      return;
    }
    if (!shopPhone) {
      setError('La tienda aún no configura su número de WhatsApp. Avísale al administrador.');
      return;
    }
    setSending(true);
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: name.trim(),
          phone: phone.trim(),
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            price_cents: i.price_cents,
            with_installation: i.with_installation,
            installation_price_cents: i.with_installation ? i.installation_price_cents : 0
          })),
          total_cents: totalCents,
          note
        })
      });
      clear();
      window.open(whatsappLink(shopPhone, buildMessage(phone)), '_blank');
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Header />
      <div className="container" style={{ maxWidth: 720, padding: '24px 16px' }}>
        <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
          ← Seguir comprando
        </Link>
        {items.length === 0 ? (
          <div className="card-panel empty-state">
            <p>Tu carrito está vacío.</p>
            <Link to="/" className="btn btn-primary">
              Ir al catálogo
            </Link>
          </div>
        ) : (
          <>
            <div className="card-panel">
              <h2 className="admin-title">Resumen de tu pedido</h2>
              {items.map((item) => {
                const itemCents = item.price_cents * item.quantity;
                const installCents = item.with_installation ? item.installation_price_cents * item.quantity : 0;
                return (
                  <div key={item.product_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="order-summary-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span>
                        {item.quantity}× {item.name}
                      </span>
                      <strong>{money(itemCents)}</strong>
                    </div>
                    {item.with_installation && (
                      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                        🛠 Incluye instalación <strong>{money(installCents)}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="total-row" style={{ marginTop: 12 }}>
                <span>Total</span>
                <span>{money(totalCents)}</span>
              </div>
            </div>

            <div className="card-panel">
              <h2 className="admin-title">Tus datos</h2>
              <div className="form-grid">
                <div className="form-field">
                  <span>Nombre completo *</span>
                  <input value={name} placeholder="Tu nombre" onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="form-field">
                  <span>Tu teléfono</span>
                  <input value={phone} placeholder="Para que te contacten" onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Nota (opcional)</span>
                  <textarea value={note} placeholder="Algún detalle de tu pedido..." onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
              {error && <div className="alert alert-error mt-8">{error}</div>}
              <button className="btn btn-whatsapp btn-block mt-8" disabled={sending} onClick={sendWhatsApp}>
                {sending ? 'Procesando...' : 'Enviar pedido por WhatsApp'}
              </button>
              <p className="muted" style={{ fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                Al confirmar se abrirá WhatsApp con tu pedido listo para enviar.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}