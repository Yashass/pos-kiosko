import { useEffect, useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, subWeeks, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDashboardStore } from '../stores/dashboardStore';
import { useProductStore } from '../stores/productStore';
import DashboardGrid from '../components/dashboard/DashboardGrid';
import type { DateRange } from '../types';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface PeriodOption { value: string; label: string; }

function buildWeekOptions(): PeriodOption[] {
  const now = new Date();
  return Array.from({ length: 16 }, (_, i) => {
    const d = subWeeks(now, i);
    const from = startOfWeek(d, { weekStartsOn: 1 });
    const to = endOfWeek(d, { weekStartsOn: 1 });
    const week = getISOWeek(d);
    const year = getYear(d);
    return {
      value: `${year}-W${String(week).padStart(2, '0')}`,
      label: `Sem ${week} · ${format(from, 'd MMM', { locale: es })} – ${format(to, 'd MMM yyyy', { locale: es })}`,
    };
  });
}

function buildMonthOptions(): PeriodOption[] {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const d = subMonths(now, i);
    return {
      value: format(d, 'yyyy-MM'),
      label: cap(format(d, 'MMMM yyyy', { locale: es })),
    };
  });
}

const TABS: { value: DateRange; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' },
  { value: 'rango', label: 'Rango' },
];

export default function DashboardPage() {
  const {
    dateRange, selectedWeek, selectedMonth, customFrom, customTo,
    setDateRange, setSelectedWeek, setSelectedMonth, setCustomRange, applyFilter,
    fetchData,
  } = useDashboardStore();
  const fetchProducts = useProductStore((s) => s.fetchProducts);

  const weekOptions = useMemo(() => buildWeekOptions(), []);
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [pendingFrom, setPendingFrom] = useState(customFrom || todayStr);
  const [pendingTo, setPendingTo] = useState(customTo || todayStr);
  const [rangePending, setRangePending] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRangeApply() {
    setCustomRange(pendingFrom, pendingTo);
    applyFilter();
    setRangePending(false);
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header + tabs */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Resumen del negocio</p>
        </div>

        <div className="flex bg-slate-100 rounded-lg p-1 gap-1 overflow-x-auto">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDateRange(value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
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

      {/* Sub-controls */}
      {dateRange === 'semana' && (
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="w-full sm:w-auto border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {weekOptions.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      )}

      {dateRange === 'mes' && (
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-full sm:w-auto border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      )}

      {dateRange === 'rango' && (
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Desde</label>
            <input
              type="date"
              value={pendingFrom}
              max={pendingTo || todayStr}
              onChange={(e) => { setPendingFrom(e.target.value); setRangePending(true); }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Hasta</label>
            <input
              type="date"
              value={pendingTo}
              min={pendingFrom}
              max={todayStr}
              onChange={(e) => { setPendingTo(e.target.value); setRangePending(true); }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleRangeApply}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              rangePending
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Buscar
          </button>
        </div>
      )}

      <DashboardGrid />
    </div>
  );
}
