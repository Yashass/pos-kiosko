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
        <span className="text-sm font-semibold text-zinc-400">Ventas por Día</span>
        <span className="text-xs text-zinc-500">
          {stats.length} {stats.length === 1 ? 'día' : 'días'}
        </span>
      </div>

      {chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">
          Sin datos en el período seleccionado
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
              <YAxis
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                labelStyle={{ fontWeight: 600, fontSize: 12, color: '#f4f4f5' }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #3f3f46',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  backgroundColor: '#18181b',
                  color: '#f4f4f5',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
              <Bar dataKey="Ventas" fill="#dc2626" radius={[3, 3, 0, 0]} />
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
      <div className="h-4 bg-zinc-800 rounded w-1/3 mb-4" />
      <div className="h-full bg-zinc-800 rounded" />
    </div>
  );
}
