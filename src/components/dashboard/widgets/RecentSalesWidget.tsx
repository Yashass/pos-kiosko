import { ShoppingBag, Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { formatCurrency } from '../../../lib/calculations';

const PAYMENT_ICON = {
  efectivo: Banknote,
  tarjeta: CreditCard,
  transferencia: ArrowLeftRight,
  mixto: ShoppingBag,
};

export default function RecentSalesWidget() {
  const { data, loading } = useDashboardStore();

  if (loading) return <Skeleton />;

  const sales = [...(data?.sales ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  ).slice(0, 10);

  return (
    <div className="h-full p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-600">Ventas Recientes</span>
        <span className="text-xs text-slate-400">{data?.sales.length ?? 0} ventas</span>
      </div>

      {sales.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          Sin ventas en el período seleccionado
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-1.5">
          {sales.map((sale) => {
            const Icon = PAYMENT_ICON[sale.payment_method] ?? ShoppingBag;
            return (
              <div key={sale.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 capitalize">{sale.payment_method}</p>
                  <p className="text-xs text-slate-400">
                    {formatDistanceToNow(parseISO(sale.created_at), { addSuffix: true, locale: es })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">{formatCurrency(sale.total)}</p>
                  <p className="text-xs text-emerald-600">{formatCurrency(sale.profit_net)} neto</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="h-full p-4 space-y-2 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/3" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className="w-8 h-8 bg-slate-200 rounded-lg" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-slate-200 rounded w-1/2" />
            <div className="h-2 bg-slate-100 rounded w-1/3" />
          </div>
          <div className="h-4 bg-slate-200 rounded w-16" />
        </div>
      ))}
    </div>
  );
}
