import { useEffect, useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '../stores/productStore';
import ProductTable from '../components/products/ProductTable';
import BulkPriceModal from '../components/products/BulkPriceModal';

export default function ProductsPage() {
  const navigate = useNavigate();
  const { products, loading, fetchProducts } = useProductStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Productos</h1>
          <p className="text-sm text-slate-500">{products.length} productos activos</p>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <button
              onClick={() => setBulkModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              <Tag size={16} />
              Actualizar precios ({selected.length})
            </button>
          )}
          <button
            onClick={() => navigate('/productos/nuevo')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nuevo producto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <ProductTable
          products={products}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
        />
      )}

      {bulkModalOpen && (
        <BulkPriceModal
          selectedIds={selected}
          onClose={() => {
            setBulkModalOpen(false);
            setSelected([]);
          }}
        />
      )}
    </div>
  );
}
