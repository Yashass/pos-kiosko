import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import ProductsPage from './pages/ProductsPage';
import ProductFormPage from './pages/ProductFormPage';
import InventoryPage from './pages/InventoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '10px', fontSize: '14px' },
        }}
      />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="ventas" element={<SalesPage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route path="productos/:id" element={<ProductFormPage />} />
          <Route path="inventario" element={<InventoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
