import { useState } from 'react';
import { Trash2, Plus, Minus, ShoppingCart, CreditCard, Banknote, ArrowLeftRight } from 'lucide-react';
import { useSaleStore } from '../../stores/saleStore';
import { formatCurrency, calcNetPrice, calcTaxInPrice } from '../../lib/calculations';
import type { PaymentMethod } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  onSaleComplete?: () => void;
}

export default function Cart({ onSaleComplete }: Props) {
  const { cart, removeFromCart, updateQuantity, clearCart, checkout, cartTotals, isProcessing } = useSaleStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const totals = cartTotals();
  const change = amountPaid ? Math.max(0, parseFloat(amountPaid || '0') - totals.total) : 0;

  async function handleCheckout() {
    try {
      const paid = paymentMethod === 'efectivo' && amountPaid ? parseFloat(amountPaid) : totals.total;
      await checkout(paymentMethod, paid);
      setAmountPaid('');
      toast.success('¡Venta registrada exitosamente!');
      onSaleComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al procesar la venta');
    }
  }

  if (!cart.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-8 gap-3">
        <ShoppingCart size={48} strokeWidth={1} />
        <p className="text-sm text-center">Escaneá un producto o buscalo para agregarlo al carrito</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Items */}
      <div className="flex-1 overflow-auto divide-y divide-zinc-800">
        {cart.map((item) => {
          const netPrice = calcNetPrice(item.unit_price, item.product.tax_rate);
          const tax = calcTaxInPrice(item.unit_price, item.product.tax_rate);
          return (
            <div key={item.product.id} className="p-3 flex gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-zinc-100 truncate">{item.product.name}</p>
                <p className="text-xs text-zinc-400">
                  {formatCurrency(item.unit_price)} c/u
                  {item.product.tax_rate > 0 && (
                    <span className="text-zinc-600"> · IVA {item.product.tax_rate}%</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-300"
                >
                  <Minus size={13} />
                </button>
                <span className="w-8 text-center font-semibold text-sm text-zinc-100">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-300"
                >
                  <Plus size={13} />
                </button>
              </div>
              <div className="text-right min-w-[72px]">
                <p className="font-semibold text-sm text-zinc-100">{formatCurrency(item.unit_price * item.quantity)}</p>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-red-500 hover:text-red-400 mt-0.5"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="border-t border-zinc-800 p-3 bg-zinc-900 space-y-2">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full text-left text-xs text-red-500 hover:underline"
        >
          {showDetails ? 'Ocultar' : 'Ver'} detalle de ganancias
        </button>

        {showDetails && (
          <div className="bg-zinc-800 rounded-lg p-2 text-xs space-y-1">
            <div className="flex justify-between text-zinc-400">
              <span>Costo total</span>
              <span>{formatCurrency(totals.cost_total)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>IVA incluido en precio</span>
              <span>{formatCurrency(totals.tax_amount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-400">
              <span>Ganancia bruta</span>
              <span>{formatCurrency(totals.profit_gross)}</span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-300">
              <span>Ganancia neta (sin IVA)</span>
              <span>{formatCurrency(totals.profit_net)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between text-sm text-zinc-400">
          <span>Subtotal</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg text-zinc-100">
          <span>Total</span>
          <span>{formatCurrency(totals.total)}</span>
        </div>

        {/* Payment method */}
        <div className="grid grid-cols-3 gap-1.5">
          {(['efectivo', 'tarjeta', 'transferencia'] as PaymentMethod[]).map((method) => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`flex flex-col items-center py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                paymentMethod === method
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-red-700'
              }`}
            >
              {method === 'efectivo' && <Banknote size={15} />}
              {method === 'tarjeta' && <CreditCard size={15} />}
              {method === 'transferencia' && <ArrowLeftRight size={15} />}
              <span className="capitalize">{method}</span>
            </button>
          ))}
        </div>

        {paymentMethod === 'efectivo' && (
          <div className="space-y-1">
            <input
              type="number"
              placeholder="Monto recibido"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 bg-zinc-800 text-zinc-100"
            />
            {change > 0 && (
              <p className="text-emerald-400 font-semibold text-sm text-right">
                Vuelto: {formatCurrency(change)}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={clearCart}
            className="flex-none px-3 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-950/30 transition-colors"
          >
            Limpiar
          </button>
          <button
            onClick={handleCheckout}
            disabled={isProcessing}
            className="flex-1 py-2.5 bg-red-700 text-white rounded-lg font-semibold text-sm hover:bg-red-800 transition-colors disabled:opacity-60"
          >
            {isProcessing ? 'Procesando…' : 'Cobrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
