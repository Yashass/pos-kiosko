import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay } from 'date-fns';
import { db, getSalesInRange } from '../lib/db';
import type { DateRange, WidgetConfig, DailyStat, ProductRanking, Sale } from '../types';

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'net_profit', title: 'Ganancia Neta', enabled: true, x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { id: 'stock_summary', title: 'Stock', enabled: true, x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { id: 'daily_sales', title: 'Ventas por Día', enabled: true, x: 0, y: 2, w: 8, h: 3, minW: 4, minH: 2 },
  { id: 'product_ranking', title: 'Ranking de Productos', enabled: true, x: 8, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
  { id: 'recent_sales', title: 'Ventas Recientes', enabled: true, x: 0, y: 5, w: 8, h: 3, minW: 4, minH: 2 },
];

interface DashboardData {
  sales: Sale[];
  dailyStats: DailyStat[];
  productRanking: ProductRanking[];
  totalRevenue: number;
  profitGross: number;
  profitNet: number;
  taxAmount: number;
}

interface DashboardStore {
  dateRange: DateRange;
  widgets: WidgetConfig[];
  data: DashboardData | null;
  loading: boolean;

  setDateRange: (range: DateRange) => void;
  setWidgets: (widgets: WidgetConfig[]) => void;
  toggleWidget: (id: string) => void;
  resetLayout: () => void;
  fetchData: () => Promise<void>;
}

function getDateRangeBounds(range: DateRange): { from: Date; to: Date } {
  const now = new Date();
  switch (range) {
    case 'hoy':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'semana':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case 'mes':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'anio':
      return { from: startOfYear(now), to: endOfDay(now) };
  }
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      dateRange: 'hoy',
      widgets: DEFAULT_WIDGETS,
      data: null,
      loading: false,

      setDateRange: (dateRange) => {
        set({ dateRange });
        get().fetchData();
      },

      setWidgets: (widgets) => set({ widgets }),

      toggleWidget: (id) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, enabled: !w.enabled } : w,
          ),
        }));
      },

      resetLayout: () => set({ widgets: DEFAULT_WIDGETS }),

      fetchData: async () => {
        set({ loading: true });
        try {
          const { from, to } = getDateRangeBounds(get().dateRange);
          const sales = await getSalesInRange(from, to);

          const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
          const profitGross = sales.reduce((acc, s) => acc + s.profit_gross, 0);
          const profitNet = sales.reduce((acc, s) => acc + s.profit_net, 0);
          const taxAmount = sales.reduce((acc, s) => acc + s.tax_amount, 0);

          // Daily stats
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

          // Product ranking
          const saleIds = sales.map((s) => s.id);
          let saleItems: Awaited<ReturnType<typeof db.saleItems.where>>[] = [];
          if (saleIds.length) {
            saleItems = await db.saleItems.where('sale_id').anyOf(saleIds).toArray() as unknown as typeof saleItems;
          }
          const rankMap: Record<string, ProductRanking> = {};
          for (const item of saleItems as unknown as { product_id?: string; product_name: string; quantity: number; subtotal: number; unit_price: number; unit_cost: number }[]) {
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
      partialize: (state) => ({ dateRange: state.dateRange, widgets: state.widgets }),
    },
  ),
);
