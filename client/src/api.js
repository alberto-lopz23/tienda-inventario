export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem('admin_token');
  if (token) headers['x-admin-token'] = token;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_shop');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

export const salePriceCents = (priceCents, discountPercent = 0) => {
  const d = Math.max(0, Math.min(100, Math.round(Number(discountPercent) || 0)));
  return Math.round((Number(priceCents) || 0) * (100 - d) / 100);
};

export const salePrice = (priceCents, discountPercent = 0) => money(salePriceCents(priceCents, discountPercent));

export const money = (cents) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(
    (cents || 0) / 100
  );

export function whatsappLink(number, text) {
  return `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}