import { TrendingUp } from 'lucide-react';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { formatCurrency } from '../../../lib/calculations';

export default function NetProfitWidget() {
  const { data, loading } = useDashboardStore();

  if (loading) return <Skeleton />;
  if (!data) return null;

  const { profitGross, profitNet, taxAmount, totalRevenue } = data;
  const marginPct = totalRevenue > 0 ? (profitNet / totalRevenue) * 100 : 0;

  return (
    <div className="h-full p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-400">Ganancia Neta</span>
        <div className="w-8 h-8 bg-emerald-900/30 rounded-lg flex items-center justify-center">
          <TrendingUp size={16} className="text-emerald-500" />
        </div>
      </div>

      <div>
        <p className="text-3xl font-bold text-emerald-400">{formatCurrency(profitNet)}</p>
        <p className="text-xs text-zinc-500 mt-0.5">Sin IVA · margen {marginPct.toFixed(1)}%</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Ganancia bruta</span>
          <span className="font-medium text-zinc-300">{formatCurrency(profitGross)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">IVA cobrado</span>
          <span className="font-medium text-amber-400">{formatCurrency(taxAmount)}</span>
        </div>
        <div className="flex justify-between text-xs pt-1 border-t border-zinc-800">
          <span className="text-zinc-500">Ventas totales</span>
          <span className="font-semibold text-zinc-100">{formatCurrency(totalRevenue)}</span>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="h-full p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-1/2" />
      <div className="h-8 bg-zinc-800 rounded w-3/4" />
      <div className="space-y-2">
        <div className="h-3 bg-zinc-800 rounded" />
        <div className="h-3 bg-zinc-800 rounded" />
        <div className="h-3 bg-zinc-800 rounded" />
      </div>
    </div>
  );
}
