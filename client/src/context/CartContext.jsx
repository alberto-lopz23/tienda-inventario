import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'tienda_cart_v2';

function normalize(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => ({
    product_id: i.product_id,
    color_id: i.color_id || null,
    color_name: i.color_name || '',
    color_hex: i.color_hex || '',
    name: i.name,
    price_cents: i.price_cents,
    list_price_cents: i.list_price_cents || i.price_cents,
    discount_percent: i.discount_percent || 0,
    image: i.image || '',
    quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
    requires_installation: !!i.requires_installation,
    installation_price_cents: i.installation_price_cents || 0,
    stock: i.stock,
    with_installation: false
  }));
}

const lineKey = (product_id, color_id) => `${product_id}:${color_id || ''}`;

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = (product, qty = 1, color = null) => {
    setItems((prev) => {
      const color_id = color?.id || null;
      const color_name = color?.name || '';
      const color_hex = color?.hex || '';
      const stock = color_id ? color.stock : product.stock;
      const key = lineKey(product.id, color_id);
      const existing = prev.find((i) => lineKey(i.product_id, i.color_id) === key);
      if (existing) {
        return prev.map((i) =>
          lineKey(i.product_id, i.color_id) === key
            ? { ...i, quantity: Math.min(i.quantity + qty, stock || i.stock), stock: stock ?? i.stock }
            : i
        );
      }
      const item = {
        product_id: product.id,
        color_id,
        color_name,
        color_hex,
        name: product.name,
        price_cents: product.price_cents,
        list_price_cents: product.list_price_cents || product.price_cents,
        discount_percent: product.discount_percent || 0,
        image: product.image,
        quantity: Math.min(qty, stock),
        requires_installation: !!product.requires_installation,
        installation_price_cents: product.installation_price_cents || 0,
        stock,
        with_installation: false
      };
      return [...prev, item];
    });
  };

  const toggleInstallation = (product_id, color_id) => {
    const key = lineKey(product_id, color_id);
    setItems((prev) =>
      prev.map((i) => (lineKey(i.product_id, i.color_id) === key ? { ...i, with_installation: !i.with_installation } : i))
    );
  };

  const updateQty = (product_id, color_id, quantity) => {
    const key = lineKey(product_id, color_id);
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => lineKey(i.product_id, i.color_id) !== key)
        : prev.map((i) =>
            lineKey(i.product_id, i.color_id) === key
              ? { ...i, quantity: i.stock > 0 ? Math.min(quantity, i.stock) : Math.max(1, quantity) }
              : i
          )
    );
  };

  const remove = (product_id, color_id) => {
    const key = lineKey(product_id, color_id);
    setItems((prev) => prev.filter((i) => lineKey(i.product_id, i.color_id) !== key));
  };
  const clear = () => setItems([]);

  const totalCents = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + i.price_cents * i.quantity + (i.with_installation ? i.installation_price_cents * i.quantity : 0),
        0
      ),
    [items]
  );
  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ items, add, toggleInstallation, updateQty, remove, clear, totalCents, count, open, setOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
