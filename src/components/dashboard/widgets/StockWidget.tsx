import { Package, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useProductStore } from '../../../stores/productStore';

export default function StockWidget() {
  const products = useProductStore((s) => s.products);
  const [showLow, setShowLow] = useState(false);
  const [showOut, setShowOut] = useState(false);

  const total = products.length;
  const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStock = products
    .filter((p) => p.stock > 0 && p.stock <= p.min_stock)
    .sort((a, b) => a.stock - b.stock);
  const outOfStock = products
    .filter((p) => p.stock === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="h-full p-4 flex flex-col gap-3 overflow-y-auto">
      {/* Header summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-slate-800">{totalUnits.toLocaleString('es-AR')}</p>
          <p className="text-xs text-slate-500 mt-0.5">unidades en {total} productos</p>
        </div>
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
          <Package size={16} className="text-blue-600" />
        </div>
      </div>

      {/* Low stock section */}
      {lowStock.length > 0 && (
        <div className="rounded-lg overflow-hidden border border-amber-100">
          <button
            onClick={() => setShowLow((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-700">
                {lowStock.length} con stock bajo
              </span>
            </div>
            {showLow ? <ChevronUp size={13} className="text-amber-500" /> : <ChevronDown size={13} className="text-amber-500" />}
          </button>
          {showLow && (
            <div className="divide-y divide-amber-50 bg-white">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs text-slate-600 truncate mr-2">{p.name}</span>
                  <span className="text-xs font-bold text-amber-600 shrink-0">
                    {p.stock} / {p.min_stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Out of stock section */}
      {outOfStock.length > 0 && (
        <div className="rounded-lg overflow-hidden border border-red-100">
          <button
            onClick={() => setShowOut((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <XCircle size={13} className="text-red-500" />
              <span className="text-xs font-semibold text-red-700">
                {outOfStock.length} sin stock
              </span>
            </div>
            {showOut ? <ChevronUp size={13} className="text-red-500" /> : <ChevronDown size={13} className="text-red-500" />}
          </button>
          {showOut && (
            <div className="divide-y divide-red-50 bg-white">
              {outOfStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs text-slate-600 truncate mr-2">{p.name}</span>
                  <span className="text-xs font-bold text-red-600 shrink-0">0</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All good */}
      {lowStock.length === 0 && outOfStock.length === 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2">
          <Package size={14} className="text-emerald-500" />
          <span className="text-xs text-emerald-700 font-medium">Stock en buen estado</span>
        </div>
      )}
    </div>
  );
}
