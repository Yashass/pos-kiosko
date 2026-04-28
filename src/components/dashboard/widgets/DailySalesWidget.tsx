import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { formatCurrency } from '../../../lib/calculations';

export default function DailySalesWidget() {
  const { data, loading } = useDashboardStore();

  if (loading) return <Skeleton />;

  const stats = data?.dailyStats ?? [];

  const chartData = stats.map((s) => ({
    label: format(parseISO(s.date), 'dd/MM', { locale: es }),
    Ventas: Math.round(s.total * 100) / 100,
    'Gan. Neta': Math.round(s.profit_net * 100) / 100,
    count: s.count,
  }));

  return (
    <div className="h-full p-4 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-600">Ventas por Día</span>
        <span className="text-xs text-slate-400">
          {stats.length} {stats.length === 1 ? 'día' : 'días'}
        </span>
      </div>

      {chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          Sin datos en el período seleccionado
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                labelStyle={{ fontWeight: 600, fontSize: 12 }}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Ventas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Gan. Neta" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="h-full p-4 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
      <div className="h-full bg-slate-100 rounded" />
    </div>
  );
}
