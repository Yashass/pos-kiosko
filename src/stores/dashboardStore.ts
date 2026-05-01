import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear,
  getISOWeek, getYear,
  parseISO, format,
} from 'date-fns';
import { db, getSalesInRange } from '../lib/db';
import type { DateRange, WidgetConfig, DailyStat, ProductRanking, Sale } from '../types';

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'net_profit', title: 'Ganancia Neta', enabled: true, x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { id: 'stock_summary', title: 'Stock', enabled: true, x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { id: 'daily_sales', title: 'Ventas por Día', enabled: true, x: 0, y: 2, w: 8, h: 3, minW: 4, minH: 2 },
  { id: 'product_ranking', title: 'Ranking de Productos', enabled: true, x: 8, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
  { id: 'recent_sales', title: 'Ventas Recientes', enabled: true, x: 0, y: 5, w: 8, h: 3, minW: 4, minH: 2 },
];

function currentWeekValue(): string {
  const now = new Date();
  return `${getYear(now)}-W${String(getISOWeek(now)).padStart(2, '0')}`;
}

function isoWeekToDates(weekValue: string): { from: Date; to: Date } {
  const [yearStr, weekStr] = weekValue.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const week1Start = startOfWeek(jan4, { weekStartsOn: 1 });
  const from = startOfDay(new Date(week1Start.getTime() + (week - 1) * 7 * 86400000));
  return { from, to: endOfDay(endOfWeek(from, { weekStartsOn: 1 })) };
}

interface FilterState {
  dateRange: DateRange;
  selectedWeek: string;
  selectedMonth: string;
  customFrom: string;
  customTo: string;
}

function computeBounds(f: FilterState): { from: Date; to: Date } {
  const now = new Date();
  switch (f.dateRange) {
    case 'hoy':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'semana':
      return isoWeekToDates(f.selectedWeek);
    case 'mes': {
      const [year, month] = f.selectedMonth.split('-').map(Number);
      const d = new Date(year, month - 1, 1);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
    case 'anio':
      return { from: startOfYear(now), to: endOfDay(now) };
    case 'rango': {
      const from = f.customFrom ? startOfDay(parseISO(f.customFrom)) : startOfDay(now);
      const to = f.customTo ? endOfDay(parseISO(f.customTo)) : endOfDay(now);
      return { from, to };
    }
  }
}

interface DashboardData {
  sales: Sale[];
  dailyStats: DailyStat[];
  productRanking: ProductRanking[];
  totalRevenue: number;
  profitGross: number;
  profitNet: number;
  taxAmount: number;
}

interface DashboardStore extends FilterState {
  savedWidgets: WidgetConfig[];
  widgets: WidgetConfig[];
  data: DashboardData | null;
  loading: boolean;

  setDateRange: (range: DateRange) => void;
  setSelectedWeek: (week: string) => void;
  setSelectedMonth: (month: string) => void;
  setCustomRange: (from: string, to: string) => void;
  applyFilter: () => void;

  setWidgets: (widgets: WidgetConfig[]) => void;
  toggleWidget: (id: string) => void;
  saveLayout: () => void;
  resetLayout: () => void;
  fetchData: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      dateRange: 'hoy' as DateRange,
      selectedWeek: currentWeekValue(),
      selectedMonth: format(new Date(), 'yyyy-MM'),
      customFrom: format(new Date(), 'yyyy-MM-dd'),
      customTo: format(new Date(), 'yyyy-MM-dd'),
      savedWidgets: DEFAULT_WIDGETS,
      widgets: DEFAULT_WIDGETS,
      data: null,
      loading: false,

      setDateRange: (dateRange) => {
        set({ dateRange });
        get().fetchData();
      },

      setSelectedWeek: (selectedWeek) => {
        set({ selectedWeek, dateRange: 'semana' });
        get().fetchData();
      },

      setSelectedMonth: (selectedMonth) => {
        set({ selectedMonth, dateRange: 'mes' });
        get().fetchData();
      },

      setCustomRange: (customFrom, customTo) => {
        set({ customFrom, customTo, dateRange: 'rango' });
      },

      applyFilter: () => get().fetchData(),

      setWidgets: (widgets) => set({ widgets }),

      toggleWidget: (id) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, enabled: !w.enabled } : w,
          ),
        }));
      },

      saveLayout: () => {
        const { widgets } = get();
        set({ savedWidgets: widgets });
      },

      resetLayout: () => {
        const { savedWidgets } = get();
        set({ widgets: savedWidgets });
      },

      fetchData: async () => {
        set({ loading: true });
        try {
          const state = get();
          const { from, to } = computeBounds(state);
          const allSales = await getSalesInRange(from, to);
          // Exclude cancelled sales from financial stats
          const sales = allSales.filter((s) => !s.cancelled_at);

          const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
          const profitGross = sales.reduce((acc, s) => acc + s.profit_gross, 0);
          const profitNet = sales.reduce((acc, s) => acc + s.profit_net, 0);
          const taxAmount = sales.reduce((acc, s) => acc + s.tax_amount, 0);

          const dailyMap: Record<string, DailyStat> = {};
          for (const sale of sales) {
            const day = sale.created_at.substring(0, 10);
            if (!dailyMap[day]) {
              dailyMap[day] = { date: day, total: 0, profit_net: 0, profit_gross: 0, count: 0 };
            }
            dailyMap[day].total += sale.total;
            dailyMap[day].profit_net += sale.profit_net;
            dailyMap[day].profit_gross += sale.profit_gross;
            dailyMap[day].count += 1;
          }
          const dailyStats = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

          const saleIds = sales.map((s) => s.id);
          const saleItems = saleIds.length
            ? await db.saleItems.where('sale_id').anyOf(saleIds).toArray()
            : [];

          const rankMap: Record<string, ProductRanking> = {};
          for (const item of saleItems as { product_id?: string; product_name: string; quantity: number; subtotal: number; unit_price: number; unit_cost: number }[]) {
            const key = item.product_id ?? item.product_name;
            if (!rankMap[key]) {
              rankMap[key] = { product_id: key, product_name: item.product_name, quantity: 0, revenue: 0, profit: 0 };
            }
            rankMap[key].quantity += item.quantity;
            rankMap[key].revenue += item.subtotal;
            rankMap[key].profit += (item.unit_price - item.unit_cost) * item.quantity;
          }
          const productRanking = Object.values(rankMap)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

          set({ data: { sales, dailyStats, productRanking, totalRevenue, profitGross, profitNet, taxAmount }, loading: false });
        } catch {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'pos-dashboard',
      partialize: (state) => ({
        dateRange: state.dateRange,
        selectedWeek: state.selectedWeek,
        selectedMonth: state.selectedMonth,
        customFrom: state.customFrom,
        customTo: state.customTo,
        widgets: state.widgets,
        savedWidgets: state.savedWidgets,
      }),
    },
  ),
);
