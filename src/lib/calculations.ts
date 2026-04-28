import type { CartItem, Sale, SaleItem } from '../types';

export function calcNetPrice(price: number, taxRate: number): number {
  if (taxRate <= 0) return price;
  return price / (1 + taxRate / 100);
}

export function calcTaxInPrice(price: number, taxRate: number): number {
  return price - calcNetPrice(price, taxRate);
}

export function calcProfitGross(price: number, cost: number): number {
  return price - cost;
}

export function calcProfitNet(price: number, cost: number, taxRate: number): number {
  return calcNetPrice(price, taxRate) - cost;
}

export function calcMarginPct(price: number, cost: number, taxRate: number): number {
  if (cost <= 0) return 0;
  return (calcProfitNet(price, cost, taxRate) / cost) * 100;
}

export function calcPriceFromMargin(cost: number, marginPct: number, taxRate: number): number {
  const netPrice = cost * (1 + marginPct / 100);
  return netPrice * (1 + taxRate / 100);
}

export function calcCartTotals(items: CartItem[]): {
  subtotal: number;
  tax_amount: number;
  total: number;
  cost_total: number;
  profit_gross: number;
  profit_net: number;
} {
  let subtotal = 0;
  let tax_amount = 0;
  let cost_total = 0;
  let profit_gross = 0;
  let profit_net = 0;

  for (const item of items) {
    const itemTotal = item.unit_price * item.quantity;
    const itemCost = item.unit_cost * item.quantity;
    const taxInItem = calcTaxInPrice(item.unit_price, item.product.tax_rate) * item.quantity;
    const netPrice = calcNetPrice(item.unit_price, item.product.tax_rate) * item.quantity;

    subtotal += itemTotal;
    tax_amount += taxInItem;
    cost_total += itemCost;
    profit_gross += itemTotal - itemCost;
    profit_net += netPrice - itemCost;
  }

  return {
    subtotal,
    tax_amount,
    total: subtotal,
    cost_total,
    profit_gross,
    profit_net,
  };
}

export function applyPercentage(value: number, pct: number): number {
  return value * (1 + pct / 100);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function buildSaleItems(items: CartItem[], saleId: string): SaleItem[] {
  return items.map((item) => ({
    id: crypto.randomUUID(),
    sale_id: saleId,
    product_id: item.product.id,
    product_name: item.product.name,
    product_barcode: item.product.barcode,
    quantity: item.quantity,
    unit_price: item.unit_price,
    unit_cost: item.unit_cost,
    tax_rate: item.product.tax_rate,
    subtotal: item.unit_price * item.quantity,
    created_at: new Date().toISOString(),
  }));
}

export function buildSale(
  items: CartItem[],
  paymentMethod: Sale['payment_method'],
  amountPaid?: number,
): Omit<Sale, 'items'> {
  const totals = calcCartTotals(items);
  const id = crypto.randomUUID();

  return {
    id,
    subtotal: totals.subtotal,
    tax_amount: totals.tax_amount,
    total: totals.total,
    cost_total: totals.cost_total,
    profit_gross: totals.profit_gross,
    profit_net: totals.profit_net,
    payment_method: paymentMethod,
    amount_paid: amountPaid,
    change_given: amountPaid ? Math.max(0, amountPaid - totals.total) : 0,
    created_at: new Date().toISOString(),
    _synced: 0,
  };
}
