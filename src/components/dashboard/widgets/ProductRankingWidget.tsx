import { Trophy } from 'lucide-react';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { formatCurrency } from '../../../lib/calculations';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function ProductRankingWidget() {
  const { data, loading } = useDashboardStore();

  if (loading) return <Skeleton />;

  const ranking = data?.productRanking ?? [];

  return (
    <div className="h-full p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-600">Ranking de Productos</span>
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
          <Trophy size={16} className="text-amber-600" />
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs text-center">
          Sin ventas en el período seleccionado
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-1.5">
          {ranking.map((item, idx) => {
            const maxQty = ranking[0].quantity;
            const pct = maxQty > 0 ? (item.quantity / maxQty) * 100 : 0;
            return (
              <div key={item.product_id} className="group">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm w-5 flex-shrink-0">{MEDAL[idx] ?? `${idx + 1}.`}</span>
                  <span className="text-xs font-medium text-slate-700 truncate flex-1">
                    {item.product_name}
                  </span>
                  <span className="text-xs text-slate-500 flex-shrink-0">{item.quantity} u.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 w-20 text-right">
                    {formatCurrency(item.revenue)}
                  </span>
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
    <div className="h-full p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/2" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="h-3 bg-slate-200 rounded" />
          <div className="h-1.5 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}
