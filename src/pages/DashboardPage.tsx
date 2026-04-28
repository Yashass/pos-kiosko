import { useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import { useProductStore } from '../stores/productStore';
import DashboardGrid from '../components/dashboard/DashboardGrid';
import type { DateRange } from '../types';

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' },
];

export default function DashboardPage() {
  const { dateRange, setDateRange, fetchData } = useDashboardStore();
  const fetchProducts = useProductStore((s) => s.fetchProducts);

  useEffect(() => {
    fetchProducts();
    fetchData();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Resumen del negocio</p>
        </div>

        {/* Date range selector */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {DATE_RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDateRange(value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                dateRange === value
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <DashboardGrid />
    </div>
  );
}
