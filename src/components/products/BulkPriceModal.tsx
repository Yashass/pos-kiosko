import { useState } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useProductStore } from '../../stores/productStore';
import { formatCurrency, applyPercentage } from '../../lib/calculations';
import type { BulkUpdateOptions, Product } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  selectedIds: string[];
  onClose: () => void;
}

export default function BulkPriceModal({ selectedIds, onClose }: Props) {
  const { products, bulkUpdatePrices } = useProductStore();
  const [field, setField] = useState<BulkUpdateOptions['field']>('cost');
  const [percentage, setPercentage] = useState('');
  const [recalculatePrice, setRecalculatePrice] = useState(true);
  const [loading, setLoading] = useState(false);

  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
  const pct = parseFloat(percentage) || 0;

  function previewPrice(product: Product) {
    const newCost = field === 'cost' || field === 'both' ? applyPercentage(product.cost, pct) : product.cost;
    let newPrice = product.price;
    if (field === 'price' || field === 'both') {
      newPrice = applyPercentage(product.price, pct);
    } else if (field === 'cost' && recalculatePrice) {
      const margin = product.cost > 0 ? (product.price - product.cost) / product.cost : 0;
      newPrice = newCost * (1 + margin);
    }
    return { newCost, newPrice };
  }

  async function handleApply() {
    if (!pct || !selectedIds.length) return;
    setLoading(true);
    try {
      await bulkUpdatePrices(selectedIds, { field, percentage: pct, recalculatePrice });
      toast.success(`Actualización aplicada a ${selectedIds.length} productos`);
      onClose();
    } catch {
      toast.error('Error al actualizar precios');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-800">
            Actualización masiva de precios
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({selectedIds.length} productos)
            </span>
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-auto">
          {/* Field selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">¿Qué actualizar?</label>
            <div className="grid grid-cols-3 gap-2">
              {(['cost', 'price', 'both'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setField(f)}
                  className={`py-2 px-3 rounded-lg text-sm border font-medium transition-colors ${
                    field === f
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {f === 'cost' ? 'Solo costo' : f === 'price' ? 'Solo precio' : 'Ambos'}
                </button>
              ))}
            </div>
          </div>

          {/* Percentage input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Porcentaje de cambio</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="Ej: 15 (aumento) o -10 (descuento)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">%</span>
              </div>
              <div className="flex gap-1">
                {[5, 10, 15, 20, 25].map((v) => (
                  <button
                    key={v}
                    onClick={() => setPercentage(String(v))}
                    className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                  >
                    +{v}%
                  </button>
                ))}
              </div>
            </div>
            {pct > 0 && (
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <TrendingUp size={13} />
                Aumento del {pct}%
              </div>
            )}
            {pct < 0 && (
              <div className="flex items-center gap-1 text-xs text-red-500">
                <TrendingDown size={13} />
                Descuento del {Math.abs(pct)}%
              </div>
            )}
          </div>

          {/* Recalculate price option */}
          {field === 'cost' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recalculatePrice}
                onChange={(e) => setRecalculatePrice(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700">Recalcular precio manteniendo el mismo margen de ganancia</span>
            </label>
          )}

          {/* Preview */}
          {pct !== 0 && selectedProducts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Vista previa</p>
              <div className="overflow-auto max-h-48 rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Producto</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Costo actual → nuevo</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Precio actual → nuevo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProducts.map((p) => {
                      const { newCost, newPrice } = previewPrice(p);
                      return (
                        <tr key={p.id}>
                          <td className="px-3 py-1.5 font-medium text-slate-700">{p.name}</td>
                          <td className="px-3 py-1.5 text-right">
                            <span className="text-slate-400">{formatCurrency(p.cost)}</span>
                            {' → '}
                            <span className="font-semibold text-slate-800">{formatCurrency(newCost)}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <span className="text-slate-400">{formatCurrency(p.price)}</span>
                            {' → '}
                            <span className="font-semibold text-slate-800">{formatCurrency(newPrice)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Esta acción actualizará los precios de los productos seleccionados. Se guardará un historial de cambios.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={!pct || !selectedIds.length || loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
          >
            {loading ? 'Aplicando…' : 'Aplicar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
