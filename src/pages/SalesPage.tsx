import { useEffect, useRef, useState } from 'react';
import { Search, ScanLine, X } from 'lucide-react';
import { useProductStore } from '../stores/productStore';
import { useSaleStore } from '../stores/saleStore';
import { getProductByBarcode } from '../lib/db';
import Cart from '../components/sales/Cart';
import BarcodeScanner from '../components/sales/BarcodeScanner';
import { formatCurrency } from '../lib/calculations';
import toast from 'react-hot-toast';
import type { Product } from '../types';

export default function SalesPage() {
  const { products, fetchProducts } = useProductStore();
  const { addToCart } = useSaleStore();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    const q = search.toLowerCase();
    const found = products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode ?? '').includes(q),
      )
      .slice(0, 8);
    setResults(found);
    setShowResults(true);
  }, [search, products]);

  async function handleBarcodeScan(barcode: string) {
    setScannerOpen(false);
    const product = await getProductByBarcode(barcode);
    if (product) {
      addToCart(product);
      toast.success(`${product.name} agregado`);
    } else {
      toast.error(`Código ${barcode} no encontrado`);
    }
  }

  async function handleManualBarcode(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const barcode = search.trim();
    if (!barcode) return;

    const product = await getProductByBarcode(barcode);
    if (product) {
      addToCart(product);
      setSearch('');
      setShowResults(false);
      toast.success(`${product.name} agregado`);
    }
  }

  function selectProduct(product: Product) {
    addToCart(product);
    setSearch('');
    setShowResults(false);
    inputRef.current?.focus();
    toast.success(`${product.name} agregado`);
  }

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Product search panel */}
      <div className="flex flex-col p-4 md:flex-1 md:border-r border-zinc-800 md:max-w-md lg:max-w-lg max-h-[40vh] md:max-h-none overflow-hidden">
        <h1 className="text-xl font-bold text-zinc-100 mb-4">Nueva Venta</h1>

        {/* Search bar */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleManualBarcode}
                placeholder="Buscar producto o ingresar código de barras…"
                className="w-full pl-9 pr-3 py-2.5 border border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600 bg-zinc-900 text-zinc-100"
                autoFocus
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setShowResults(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setScannerOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-red-700 text-white rounded-xl text-sm font-medium hover:bg-red-800 transition-colors"
            >
              <ScanLine size={18} />
              <span className="hidden sm:inline">Escanear</span>
            </button>
          </div>

          {/* Dropdown results */}
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-lg z-10 overflow-hidden">
              {results.map((product) => (
                <button
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-zinc-100 truncate">{product.name}</p>
                    <p className="text-xs text-zinc-500">
                      {product.barcode && <span className="font-mono mr-2">{product.barcode}</span>}
                      Stock: {product.stock}
                    </p>
                  </div>
                  <span className="font-bold text-zinc-100 text-sm flex-shrink-0">
                    {formatCurrency(product.price)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product grid (frequent items) */}
        <div className="mt-4 flex-1 overflow-auto">
          <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Productos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {products
              .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
              .slice(0, 30)
              .map((product) => (
                <button
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  className="flex flex-col items-start p-3 bg-zinc-900 border border-zinc-700 rounded-xl hover:border-red-700 hover:bg-zinc-800 transition-all text-left group"
                >
                  <p className="text-xs font-semibold text-zinc-300 truncate w-full group-hover:text-red-400">
                    {product.name}
                  </p>
                  <p className="text-sm font-bold text-zinc-100 mt-1">{formatCurrency(product.price)}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Stock: {product.stock}</p>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Cart panel */}
      <div className="flex-1 md:flex-none md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-900 flex flex-col min-h-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800 flex-none">
          <h2 className="font-bold text-zinc-200">Carrito</h2>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <Cart />
        </div>
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
