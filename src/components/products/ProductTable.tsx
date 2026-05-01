import { useState } from 'react';
import { Edit, Trash2, AlertTriangle, Search, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '../../stores/productStore';
import { formatCurrency, calcNetPrice, calcProfitNet, calcMarginPct } from '../../lib/calculations';
import type { Product } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  products: Product[];
  selectable?: boolean;
  selected?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

type SortKey = 'name' | 'cost' | 'price' | 'stock' | 'margin';

export default function ProductTable({ products, selectable, selected = [], onSelectionChange }: Props) {
  const navigate = useNavigate();
  const { deleteProduct } = useProductStore();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterLowStock, setFilterLowStock] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  function toggleSelect(id: string) {
    if (!onSelectionChange) return;
    if (selected.includes(id)) {
      onSelectionChange(selected.filter((s) => s !== id));
    } else {
      onSelectionChange([...selected, id]);
    }
  }

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    if (selected.length === filtered.length) onSelectionChange([]);
    else onSelectionChange(filtered.map((p) => p.id));
  }

  async function handleDelete(product: Product) {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    await deleteProduct(product.id);
    toast.success('Producto eliminado');
  }

  const filtered = products
    .filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q);
      const matchStock = !filterLowStock || p.stock <= p.min_stock;
      return matchSearch && matchStock;
    })
    .sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === 'name') { av = a.name; bv = b.name; }
      else if (sortKey === 'cost') { av = a.cost; bv = b.cost; }
      else if (sortKey === 'price') { av = a.price; bv = b.price; }
      else if (sortKey === 'stock') { av = a.stock; bv = b.stock; }
      else if (sortKey === 'margin') {
        av = calcMarginPct(a.price, a.cost, a.tax_rate);
        bv = calcMarginPct(b.price, b.cost, b.tax_rate);
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={12} className="opacity-20" />;
    return sortAsc ? <ChevronUp size={12} className="text-red-500" /> : <ChevronDown size={12} className="text-red-500" />;
  }

  function Th({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) {
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-200 select-none ${className}`}
      >
        <span className="flex items-center gap-1">{label}<SortIcon col={col} /></span>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 bg-zinc-900 text-zinc-100"
          />
        </div>
        <button
          onClick={() => setFilterLowStock(!filterLowStock)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
            filterLowStock
              ? 'bg-amber-950/30 border-amber-700 text-amber-400'
              : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
          }`}
        >
          <Filter size={14} />
          Stock bajo
        </button>
      </div>

      <p className="text-xs text-zinc-500">{filtered.length} productos</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800 border-b border-zinc-700">
            <tr>
              {selectable && (
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
              )}
              <Th col="name" label="Producto" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Código</th>
              <Th col="cost" label="Costo" className="text-right" />
              <Th col="price" label="Precio" className="text-right" />
              <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">Precio s/IVA</th>
              <Th col="margin" label="Margen" className="text-right" />
              <Th col="stock" label="Stock" className="text-right" />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((product) => {
              const netPrice = calcNetPrice(product.price, product.tax_rate);
              const margin = calcMarginPct(product.price, product.cost, product.tax_rate);
              const profitNet = calcProfitNet(product.price, product.cost, product.tax_rate);
              const isLowStock = product.stock <= product.min_stock;
              const isSelected = selected.includes(product.id);

              return (
                <tr
                  key={product.id}
                  className={`hover:bg-zinc-800 transition-colors ${isSelected ? 'bg-red-950/20' : ''}`}
                >
                  {selectable && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(product.id)}
                        className="rounded"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <div>
                      <p className="font-medium text-zinc-100">{product.name}</p>
                      {product.category && (
                        <p className="text-xs text-zinc-500">{product.category.name}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-500 font-mono">{product.barcode ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-zinc-300">{formatCurrency(product.cost)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-zinc-100">{formatCurrency(product.price)}</td>
                  <td className="px-3 py-2.5 text-right text-zinc-500">{formatCurrency(netPrice)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-semibold ${margin >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                      {margin.toFixed(1)}%
                    </span>
                    <p className="text-xs text-zinc-500">{formatCurrency(profitNet)}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isLowStock && <AlertTriangle size={13} className="text-amber-500" />}
                      <span className={isLowStock ? 'text-amber-500 font-semibold' : 'text-zinc-300'}>
                        {product.stock}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">mín. {product.min_stock}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/productos/${product.id}`)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        className="p-1.5 text-red-500 hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-zinc-500 text-sm">
                  No se encontraron productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
