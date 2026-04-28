import { Package, AlertTriangle, XCircle } from 'lucide-react';
import { useProductStore } from '../../../stores/productStore';

export default function StockWidget() {
  const products = useProductStore((s) => s.products);

  const total = products.length;
  const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.min_stock);
  const outOfStock = products.filter((p) => p.stock === 0);

  return (
    <div className="h-full p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">Stock</span>
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <Package size={16} className="text-blue-600" />
        </div>
      </div>

      <div>
        <p className="text-3xl font-bold text-slate-800">{totalUnits.toLocaleString('es-AR')}</p>
        <p className="text-xs text-slate-500 mt-0.5">unidades en {total} productos</p>
      </div>

      <div className="space-y-2">
        {lowStock.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-amber-700">{lowStock.length}</span>
              <span className="text-amber-600"> con stock bajo</span>
            </div>
          </div>
        )}
        {outOfStock.length > 0 && (
          <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
            <XCircle size={14} className="text-red-500 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-red-700">{outOfStock.length}</span>
              <span className="text-red-600"> sin stock</span>
            </div>
          </div>
        )}
        {lowStock.length === 0 && outOfStock.length === 0 && (
          <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2">
            <Package size={14} className="text-emerald-500" />
            <span className="text-xs text-emerald-700 font-medium">Stock en buen estado</span>
          </div>
        )}
      </div>
    </div>
  );
}
