import { Route, Routes } from 'react-router-dom';
import Catalog from './pages/Catalog.jsx';
import Checkout from './pages/Checkout.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Products from './pages/admin/Products.jsx';
import Stock from './pages/admin/Stock.jsx';
import Orders from './pages/admin/Orders.jsx';
import Settings from './pages/admin/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Catalog />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="productos" element={<Products />} />
        <Route path="stock" element={<Stock />} />
        <Route path="pedidos" element={<Orders />} />
        <Route path="config" element={<Settings />} />
      </Route>
    </Routes>
  );
}