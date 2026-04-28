import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Calculator, ScanLine } from 'lucide-react';
import { useProductStore } from '../stores/productStore';
import {
  calcNetPrice, calcTaxInPrice, calcProfitNet, calcProfitGross, calcMarginPct, formatCurrency,
} from '../lib/calculations';
import toast from 'react-hot-toast';
import BarcodeScanner from '../components/sales/BarcodeScanner';
import { getProductByBarcode } from '../lib/db';
import type { Product } from '../types';

type FormData = Omit<Product, 'id' | 'created_at' | 'updated_at' | '_synced' | '_deleted' | 'category'>;

const EMPTY: FormData = {
  name: '',
  barcode: '',
  category_id: '',
  cost: 0,
  price: 0,
  tax_rate: 21,
  stock: 0,
  min_stock: 3,
  unit: 'unidad',
  entry_date: new Date().toISOString().substring(0, 10),
  active: true,
};

export default function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = id && id !== 'nuevo';
  const { products, categories, addProduct, updateProduct, fetchProducts, fetchCategories } = useProductStore();

  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [marginInput, setMarginInput] = useState('');
  const [useMargin, setUseMargin] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isEditing) {
      const product = products.find((p) => p.id === id);
      if (product) {
        const { id: _id, created_at: _c, updated_at: _u, _synced: _s, _deleted: _d, category: _cat, ...formData } = product;
        setForm(formData);
      }
    }
  }, [id, products]);

  async function handleBarcodeScan(barcode: string) {
    setScannerOpen(false);
    const existing = await getProductByBarcode(barcode);
    if (existing && existing.id !== id) {
      toast.error(`Ya existe un producto con ese código: ${existing.name}`);
    } else {
      set('barcode', barcode);
      toast.success('Código escaneado');
    }
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyMargin() {
    const margin = parseFloat(marginInput);
    if (!isNaN(margin) && form.cost > 0) {
      const netPrice = form.cost * (1 + margin / 100);
      const finalPrice = netPrice * (1 + form.tax_rate / 100);
      set('price', Math.round(finalPrice * 100) / 100);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return; }
    if (form.price <= 0) { toast.error('El precio debe ser mayor a 0'); return; }

    setLoading(true);
    try {
      if (isEditing) {
        await updateProduct(id, form);
        toast.success('Producto actualizado');
      } else {
        await addProduct(form);
        toast.success('Producto creado');
      }
      navigate('/productos');
    } catch {
      toast.error('Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  }

  const netPrice = calcNetPrice(form.price, form.tax_rate);
  const taxInPrice = calcTaxInPrice(form.price, form.tax_rate);
  const profitGross = calcProfitGross(form.price, form.cost);
  const profitNet = calcProfitNet(form.price, form.cost, form.tax_rate);
  const margin = calcMarginPct(form.price, form.cost, form.tax_rate);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/productos')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? 'Editar producto' : 'Nuevo producto'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <h2 className="font-semibold text-slate-700">Información general</h2>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="input"
              placeholder="Ej: Coca-Cola 500ml"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Código de barras</label>
              <div className="flex gap-1.5">
                <input
                  value={form.barcode ?? ''}
                  onChange={(e) => set('barcode', e.target.value)}
                  className="input font-mono flex-1 min-w-0"
                  placeholder="EAN-13 / Code128…"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  title="Escanear código de barras"
                  className="flex-shrink-0 px-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ScanLine size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Categoría</label>
              <select
                value={form.category_id ?? ''}
                onChange={(e) => set('category_id', e.target.value)}
                className="input"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Unidad</label>
              <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className="input">
                {['unidad', 'kg', 'g', 'litro', 'ml', 'pack'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Fecha de ingreso</label>
              <input
                type="date"
                value={form.entry_date}
                onChange={(e) => set('entry_date', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <h2 className="font-semibold text-slate-700">Precio y costos</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Costo *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.cost || ''}
                  onChange={(e) => set('cost', parseFloat(e.target.value) || 0)}
                  className="input pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">IVA (%)</label>
              <select
                value={form.tax_rate}
                onChange={(e) => set('tax_rate', parseFloat(e.target.value))}
                className="input"
              >
                <option value={0}>0% (exento)</option>
                <option value={10.5}>10.5%</option>
                <option value={21}>21%</option>
                <option value={27}>27%</option>
              </select>
            </div>
          </div>

          {/* Margin helper */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input
                type="checkbox"
                checked={useMargin}
                onChange={(e) => setUseMargin(e.target.checked)}
                className="rounded"
              />
              Calcular precio desde margen de ganancia
            </label>
            {useMargin && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.1"
                    value={marginInput}
                    onChange={(e) => setMarginInput(e.target.value)}
                    placeholder="Margen % sobre costo"
                    className="input pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                </div>
                <button
                  type="button"
                  onClick={applyMargin}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  <Calculator size={14} />
                  Calcular
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Precio de venta (con IVA incluido) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price || ''}
                onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
                className="input pl-7"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Profit preview */}
          {form.price > 0 && form.cost > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-slate-500">Precio sin IVA</p>
                <p className="font-bold text-slate-700">{formatCurrency(netPrice)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-slate-500">IVA en el precio</p>
                <p className="font-bold text-blue-600">{formatCurrency(taxInPrice)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-slate-500">Ganancia bruta</p>
                <p className={`font-bold ${profitGross >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                  {formatCurrency(profitGross)}
                </p>
              </div>
              <div className={`rounded-lg p-2.5 ${profitNet >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <p className="text-slate-500">Ganancia neta (sin IVA)</p>
                <p className={`font-bold ${profitNet >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatCurrency(profitNet)}
                  <span className="font-normal text-slate-400 ml-1">({margin.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stock */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <h2 className="font-semibold text-slate-700">Stock</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Stock inicial</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => set('stock', parseInt(e.target.value) || 0)}
                className="input"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Stock mínimo (alerta)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.min_stock}
                onChange={(e) => set('min_stock', parseInt(e.target.value) || 0)}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/productos')}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            <Save size={16} />
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>

      {scannerOpen && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setScannerOpen(false)} />
      )}
    </div>
  );
}
