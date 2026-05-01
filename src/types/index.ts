export interface Category {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  category_id?: string;
  category?: Category;
  cost: number;
  price: number;
  tax_rate: number;       // porcentaje, ej: 21 = 21%
  stock: number;
  min_stock: number;
  unit: string;
  entry_date: string;
  image_url?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  _synced?: number;       // 0 = pendiente, 1 = sincronizado
  _deleted?: number;      // 1 = eliminado localmente
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id?: string;
  product_name: string;
  product_barcode?: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  tax_rate: number;
  subtotal: number;
  created_at: string;
}

export interface Sale {
  id: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  cost_total: number;
  profit_gross: number;    // ganancia bruta (price - cost)
  profit_net: number;      // ganancia neta (sin IVA)
  payment_method: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  amount_paid?: number;
  change_given: number;
  notes?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  items?: SaleItem[];
  created_at: string;
  _synced?: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  type: 'compra' | 'venta' | 'ajuste' | 'devolucion';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  unit_cost?: number;
  created_at: string;
  _synced?: number;
}

export interface PriceHistory {
  id: string;
  product_id: string;
  old_cost?: number;
  new_cost?: number;
  old_price?: number;
  new_price?: number;
  change_pct?: number;
  reason?: string;
  created_at: string;
  _synced?: number;
}

export type WidgetId = 'net_profit' | 'stock_summary' | 'product_ranking' | 'daily_sales' | 'recent_sales';

export interface WidgetConfig {
  id: WidgetId;
  title: string;
  enabled: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export type DateRange = 'hoy' | 'semana' | 'mes' | 'anio' | 'rango';

export interface DashboardConfig {
  dateRange: DateRange;
  widgets: WidgetConfig[];
}

export interface DailyStat {
  date: string;
  total: number;
  profit_net: number;
  profit_gross: number;
  count: number;
}

export interface ProductRanking {
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export interface SyncStatus {
  lastSync: string | null;
  pending: number;
  syncing: boolean;
  error: string | null;
}

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';

export interface BulkUpdateOptions {
  field: 'cost' | 'price' | 'both';
  percentage: number;
  recalculatePrice: boolean;
}
