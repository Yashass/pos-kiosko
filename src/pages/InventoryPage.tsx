import { useEffect, useRef, useState } from 'react';
import { Plus, Minus, History, Package, ScanLine, Search, X } from 'lucide-react';
import { useProductStore } from '../stores/productStore';
import { db, getStockMovements, getProductByBarcode } from '../lib/db';
import { formatCurrency } from '../lib/calculations';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import BarcodeScanner from '../components/sales/BarcodeScanner';
import type { Product, StockMovement } from '../types';

export default function InventoryPage() {
  const { products, fetchProducts, updateStock } = useProductStore();
  const [selected, setSelected] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [delta, setDelta] = useState('');
  const deltaRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'compra' | 'ajuste' | 'devolucion'>('compra');
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function loadMovements(product: Product) {
    setSelected(product);
    const movs = await getStockMovements(product.id);
    setMovements(movs);
    setTimeout(() => deltaRef.current?.focus(), 100);
  }

  async function handleBarcodeScan(barcode: string) {
    setScannerOpen(false);
    const product = await getProductByBarcode(barcode);
    if (product) {
      await loadMovements(product);
      toast.success(`Producto encontrado: ${product.name}`);
    } else {
      toast.error(`No se encontró ningún producto con código ${barcode}`);
    }
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
      toast.success(`Stock ${direction === 'add' ? 'aumentado' : 'disminuido'} correctamente`);
      deltaRef.current?.focus();
    } catch {
      toast.error('Error al actualizar el stock');
    } finally {
      setLoading(false);
    }
  }

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.min_stock);
  const outOfStock = products.filter((p) => p.stock === 0);

  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q);
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-zinc-100">Inventario</h1>
        <button
          onClick={() => setScannerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-xl text-sm font-medium hover:bg-red-800 transition-colors"
        >
          <ScanLine size={16} />
          Escanear producto
        </button>
      </div>

      {/* Alerts */}
      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {outOfStock.length > 0 && (
            <div className="bg-red-950/30 border border-red-800 rounded-xl p-3">
              <p className="font-semibold text-red-400 text-sm">Sin stock ({outOfStock.length})</p>
              <div className="mt-1 space-y-0.5">
                {outOfStock.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadMovements(p)}
                    className="block text-left text-xs text-red-400 hover:text-red-300 hover:underline"
                  >
                    {p.name}
                  </button>
                ))}
                {outOfStock.length > 3 && <p className="text-xs text-red-600">y {outOfStock.length - 3} más…</p>}
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-800 rounded-xl p-3">
              <p className="font-semibold text-amber-400 text-sm">Stock bajo ({lowStock.length})</p>
              <div className="mt-1 space-y-0.5">
                {lowStock.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadMovements(p)}
                    className="block text-left text-xs text-amber-400 hover:text-amber-300 hover:underline"
                  >
                    {p.name} — {p.stock} {p.unit}
                  </button>
                ))}
                {lowStock.length > 3 && <p className="text-xs text-amber-600">y {lowStock.length - 3} más…</p>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Product list */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800 space-y-2">
            <p className="font-semibold text-sm text-zinc-300">Productos</p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código…"
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 bg-zinc-900 text-zinc-100"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800 sticky top-0 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Producto</th>
                  <th className="px-3 py-2 text-right font-semibold">Stock</th>
                  <th className="px-3 py-2 text-right font-semibold">Mín.</th>
                  <th className="px-3 py-2 text-right font-semibold hidden sm:table-cell">Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((p) => {
                  const isLow = p.stock <= p.min_stock;
                  const isOut = p.stock === 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => loadMovements(p)}
                      className={`cursor-pointer hover:bg-zinc-800 transition-colors ${selected?.id === p.id ? 'bg-red-950/30 border-l-2 border-red-600' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-zinc-100">{p.name}</p>
                        <p className="text-xs text-zinc-500">
                          {p.barcode && <span className="font-mono mr-1">{p.barcode}</span>}
                          {formatCurrency(p.cost)} costo
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`font-bold ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-zinc-100'}`}>
                          {p.stock}
                        </span>
                        <p className="text-xs text-zinc-500">{p.unit}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-500">{p.min_stock}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-500 text-xs hidden sm:table-cell">
                        {p.entry_date}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500 text-sm">
                      No se encontraron productos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="lg:w-80 space-y-3">
            {/* Adjust stock */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Package size={18} className="text-red-500 flex-shrink-0" />
                  <h3 className="font-semibold text-zinc-100 truncate">{selected.name}</h3>
                </div>
                {selected.barcode && (
                  <span className="text-xs text-zinc-500 font-mono flex-shrink-0 ml-2">{selected.barcode}</span>
                )}
              </div>

              <div className="flex items-end gap-2">
                <div>
                  <p className="text-3xl font-bold text-zinc-100">{selected.stock}</p>
                  <p className="text-xs text-zinc-500">{selected.unit} en stock</p>
                </div>
                <div className="ml-auto text-right text-xs text-zinc-500">
                  <p>Mín: {selected.min_stock}</p>
                  <p>Ingreso: {selected.entry_date}</p>
                </div>
              </div>

              <div className="space-y-2">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="input text-sm"
                >
                  <option value="compra">Compra / Ingreso de mercadería</option>
                  <option value="ajuste">Ajuste de inventario</option>
                  <option value="devolucion">Devolución</option>
                </select>

                <input
                  ref={deltaRef}
                  type="number"
                  min="0"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdjust('add');
                  }}
                  placeholder="Cantidad"
                  className="input text-lg font-semibold text-center"
                />

                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="input text-sm"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAdjust('add')}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-60 transition-colors"
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                  <button
                    onClick={() => handleAdjust('remove')}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 disabled:opacity-60 transition-colors"
                  >
                    <Minus size={16} />
                    Retirar
                  </button>
                </div>

                <button
                  onClick={() => setScannerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-500 border border-red-900 rounded-lg hover:bg-red-950/30 transition-colors"
                >
                  <ScanLine size={15} />
                  Escanear otro producto
                </button>
              </div>
            </div>

            {/* Movement history */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800 flex items-center gap-2">
                <History size={15} className="text-zinc-500" />
                <p className="font-semibold text-sm text-zinc-300">Historial de movimientos</p>
              </div>
              <div className="max-h-64 overflow-auto divide-y divide-zinc-800">
                {movements.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">Sin movimientos registrados</p>
                ) : (
                  movements.map((m) => (
                    <div key={m.id} className="px-3 py-2.5 flex items-center gap-2">
                      <span
                        className={`text-sm font-bold flex-shrink-0 w-12 text-right ${m.quantity > 0 ? 'text-emerald-500' : 'text-red-500'}`}
                      >
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-300 capitalize">{m.type}</p>
                        {m.reason && <p className="text-xs text-zinc-500 truncate">{m.reason}</p>}
                      </div>
                      <p className="text-xs text-zinc-500 flex-shrink-0">
                        {format(parseISO(m.created_at), 'dd/MM HH:mm', { locale: es })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:w-80 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center p-8 text-zinc-500">
            <div className="text-center space-y-3">
              <Package size={40} strokeWidth={1} className="mx-auto" />
              <p className="text-sm">Seleccioná o escaneá un producto para gestionar su stock</p>
              <button
                onClick={() => setScannerOpen(true)}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 transition-colors"
              >
                <ScanLine size={15} />
                Escanear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barcode scanner modal */}
      {scannerOpen && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
