import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'tienda_cart_v2';

function normalize(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => ({
    product_id: i.product_id,
    name: i.name,
    price_cents: i.price_cents,
    image: i.image || '',
    quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
    requires_installation: !!i.requires_installation,
    installation_price_cents: i.installation_price_cents || 0,
    stock: i.stock,
    with_installation: false
  }));
}

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

  const add = (product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: Math.min(i.quantity + qty, product.stock), stock: product.stock }
            : i
        );
      }
      const item = {
        product_id: product.id,
        name: product.name,
        price_cents: product.price_cents,
        image: product.image,
        quantity: Math.min(qty, product.stock),
        requires_installation: !!product.requires_installation,
        installation_price_cents: product.installation_price_cents || 0,
        stock: product.stock,
        with_installation: false
      };
      return [...prev, item];
    });
  };

  const toggleInstallation = (product_id) => {
    setItems((prev) =>
      prev.map((i) => (i.product_id === product_id ? { ...i, with_installation: !i.with_installation } : i))
    );
  };

  const updateQty = (product_id, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product_id !== product_id)
        : prev.map((i) =>
            i.product_id === product_id
              ? { ...i, quantity: i.stock > 0 ? Math.min(quantity, i.stock) : Math.max(1, quantity) }
              : i
          )
    );
  };

  const remove = (product_id) => setItems((prev) => prev.filter((i) => i.product_id !== product_id));
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
    <CartContext.Provider value={{ items, add, updateQty, remove, clear, totalCents, count, open, setOpen, toggleInstallation }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}