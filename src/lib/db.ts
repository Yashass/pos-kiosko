import Dexie, { type Table } from 'dexie';
import type { Product, Category, Sale, SaleItem, StockMovement, PriceHistory } from '../types';

class PosDatabase extends Dexie {
  products!: Table<Product>;
  categories!: Table<Category>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  stockMovements!: Table<StockMovement>;
  priceHistory!: Table<PriceHistory>;

  constructor() {
    super('pos_kiosko_v1');
    this.version(1).stores({
      products: 'id, barcode, name, category_id, active, _synced, _deleted, updated_at',
      categories: 'id, name',
      sales: 'id, created_at, _synced, payment_method',
      saleItems: 'id, sale_id, product_id, created_at',
      stockMovements: 'id, product_id, type, created_at',
      priceHistory: 'id, product_id, created_at',
    });
  }
}

export const db = new PosDatabase();

// ── Helpers ────────────────────────────────────────────────────────────────

export async function getActiveProducts(): Promise<Product[]> {
  return db.products
    .where('active')
    .equals(1)
    .and((p) => p._deleted !== 1)
    .toArray();
}

export async function getProductByBarcode(barcode: string): Promise<Product | undefined> {
  return db.products
    .where('barcode')
    .equals(barcode)
    .and((p) => p.active === true && p._deleted !== 1)
    .first();
}

export async function getSalesInRange(from: Date, to: Date): Promise<Sale[]> {
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  return db.sales
    .where('created_at')
    .between(fromISO, toISO, true, true)
    .toArray();
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  return db.saleItems.where('sale_id').equals(saleId).toArray();
}

export async function getStockMovements(productId: string): Promise<StockMovement[]> {
  return db.stockMovements
    .where('product_id')
    .equals(productId)
    .reverse()
    .sortBy('created_at');
}

export async function getPriceHistory(productId: string): Promise<PriceHistory[]> {
  return db.priceHistory
    .where('product_id')
    .equals(productId)
    .reverse()
    .sortBy('created_at');
}

export async function getUnsyncedSales(): Promise<Sale[]> {
  return db.sales.where('_synced').equals(0).toArray();
}

export async function getUnsyncedProducts(): Promise<Product[]> {
  return db.products.where('_synced').equals(0).toArray();
}
