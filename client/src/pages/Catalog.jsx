import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Header from '../components/Header.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('q', search);
    try {
      const [p, c] = await Promise.all([api(`/products?${params}`), api('/products/categories')]);
      setProducts(p);
      setCategories(c);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [category, search]);

  return (
    <>
      <Header />
      <div className="container">
        <div className="catalog-toolbar">
          <input
            className="search-box"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="chips">
          <button className={`chip ${!category ? 'active' : ''}`} onClick={() => setCategory('')}>
            Todos
          </button>
          {categories.map((c) => (
            <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="empty-state">Cargando...</div>
        ) : error ? (
          <div className="alert alert-error" style={{ margin: '20px 0' }}>{error}</div>
        ) : products.length === 0 ? (
          <div className="empty-state">No hay productos que coincidan.</div>
        ) : (
          <div className="grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}