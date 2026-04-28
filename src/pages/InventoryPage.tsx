import { useEffect, useState } from 'react';
import { Plus, Minus, History, Package } from 'lucide-react';
import { useProductStore } from '../stores/productStore';
import { db, getStockMovements } from '../lib/db';
import { formatCurrency } from '../lib/calculations';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Product, StockMovement } from '../types';

export default function InventoryPage() {
  const { products, fetchProducts, updateStock } = useProductStore();
  const [selected, setSelected] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'compra' | 'ajuste' | 'devolucion'>('compra');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function loadMovements(product: Product) {
    setSelected(product);
    const movs = await getStockMovements(product.id);
    setMovements(movs);
  }

  async function handleAdjust(direction: 'add' | 'remove') {
    if (!selected) return;
    const qty = parseInt(delta) || 0;
    if (qty <= 0) { toast.error('Ingresá una cantidad válida'); return; }
    const actualDelta = direction === 'add' ? qty : -qty;
    setLoading(true);
    try {
      await updateStock(selected.id, actualDelta, type, reason);
      const refreshed = await db.products.get(selected.id);
      if (refreshed) {
        setSelected(refreshed);
        const movs = await getStockMovements(selected.id);
        setMovements(movs);
      }
      setDelta('');
      setReason('');
      toast.success(`Stock ${direction === 'add' ? 'aumentado' : 'disminuido'}`);
    } catch {
      toast.error('Error al actualizar el stock');
    } finally {
      setLoading(false);
    }
  }

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.min_stock);
  const outOfStock = products.filter((p) => p.stock === 0);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Inventario</h1>

      {/* Alerts */}
      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {outOfStock.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="font-semibold text-red-700 text-sm">Sin stock ({outOfStock.length})</p>
              <div className="mt-1 space-y-0.5">
                {outOfStock.slice(0, 3).map((p) => (
                  <p key={p.id} className="text-xs text-red-600">{p.name}</p>
                ))}
                {outOfStock.length > 3 && <p className="text-xs text-red-400">y {outOfStock.length - 3} más…</p>}
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="font-semibold text-amber-700 text-sm">Stock bajo ({lowStock.length})</p>
              <div className="mt-1 space-y-0.5">
                {lowStock.slice(0, 3).map((p) => (
                  <p key={p.id} className="text-xs text-amber-600">{p.name} — {p.stock} {p.unit}</p>
                ))}
                {lowStock.length > 3 && <p className="text-xs text-amber-400">y {lowStock.length - 3} más…</p>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Product list */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <p className="font-semibold text-sm text-slate-700">Productos</p>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Producto</th>
                  <th className="px-3 py-2 text-right font-semibold">Stock</th>
                  <th className="px-3 py-2 text-right font-semibold">Mín.</th>
                  <th className="px-3 py-2 text-right font-semibold">Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const isLow = p.stock <= p.min_stock;
                  const isOut = p.stock === 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => loadMovements(p)}
                      className={`cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id === p.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{formatCurrency(p.cost)} costo</p>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-400">{p.min_stock}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400 text-xs">{p.entry_date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="lg:w-80 space-y-3">
            {/* Adjust stock */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-800 truncate">{selected.name}</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {selected.stock} <span className="text-sm font-normal text-slate-500">{selected.unit}</span>
              </p>

              <div className="space-y-2">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="input text-sm"
                >
                  <option value="compra">Compra / Ingreso</option>
                  <option value="ajuste">Ajuste de inventario</option>
                  <option value="devolucion">Devolución</option>
                </select>
                <input
                  type="number"
                  min="0"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="Cantidad"
                  className="input"
                />
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="input"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAdjust('add')}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Plus size={15} />
                    Agregar
                  </button>
                  <button
                    onClick={() => handleAdjust('remove')}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                  >
                    <Minus size={15} />
                    Retirar
                  </button>
                </div>
              </div>
            </div>

            {/* Movement history */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
                <History size={15} className="text-slate-500" />
                <p className="font-semibold text-sm text-slate-700">Historial</p>
              </div>
              <div className="max-h-64 overflow-auto divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Sin movimientos</p>
                ) : (
                  movements.map((m) => (
                    <div key={m.id} className="px-3 py-2.5 flex items-center gap-2">
                      <span
                        className={`text-sm font-bold flex-shrink-0 w-12 text-right ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}
                      >
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 capitalize">{m.type}</p>
                        {m.reason && <p className="text-xs text-slate-400 truncate">{m.reason}</p>}
                      </div>
                      <p className="text-xs text-slate-400 flex-shrink-0">
                        {format(parseISO(m.created_at), 'dd/MM HH:mm', { locale: es })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:w-80 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-8 text-slate-400">
            <div className="text-center">
              <Package size={40} strokeWidth={1} className="mx-auto mb-2" />
              <p className="text-sm">Seleccioná un producto para gestionar su stock</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
