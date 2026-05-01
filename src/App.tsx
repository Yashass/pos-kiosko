import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import ProductsPage from './pages/ProductsPage';
import ProductFormPage from './pages/ProductFormPage';
import InventoryPage from './pages/InventoryPage';
import LogsPage from './pages/LogsPage';

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
      <AuthGuard>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="ventas" element={<SalesPage />} />
            <Route path="historial" element={<SalesHistoryPage />} />
            <Route path="productos" element={<ProductsPage />} />
            <Route path="productos/:id" element={<ProductFormPage />} />
            <Route path="inventario" element={<InventoryPage />} />
            <Route path="logs" element={<LogsPage />} />
          </Route>
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  );
}
