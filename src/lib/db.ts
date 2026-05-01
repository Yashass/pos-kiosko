import Dexie, { type Table } from 'dexie';
import type { Product, Category, Sale, SaleItem, StockMovement, PriceHistory, SaleLog } from '../types';

class PosDatabase extends Dexie {
  products!: Table<Product>;
  categories!: Table<Category>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  stockMovements!: Table<StockMovement>;
  priceHistory!: Table<PriceHistory>;
  saleLogs!: Table<SaleLog>;

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
    // Version 2: add _synced index to stockMovements and priceHistory for sync tracking
    this.version(2).stores({
      products: 'id, barcode, name, category_id, active, _synced, _deleted, updated_at',
      categories: 'id, name',
      sales: 'id, created_at, _synced, payment_method',
      saleItems: 'id, sale_id, product_id, created_at',
      stockMovements: 'id, product_id, type, created_at, _synced',
      priceHistory: 'id, product_id, created_at, _synced',
    }).upgrade(async (tx) => {
      await tx.table('stockMovements').toCollection().modify({ _synced: 0 });
      await tx.table('priceHistory').toCollection().modify({ _synced: 0 });
    });
    // Version 3: add saleLogs table for audit trail
    this.version(3).stores({
      products: 'id, barcode, name, category_id, active, _synced, _deleted, updated_at',
      categories: 'id, name',
      sales: 'id, created_at, _synced, payment_method',
      saleItems: 'id, sale_id, product_id, created_at',
      stockMovements: 'id, product_id, type, created_at, _synced',
      priceHistory: 'id, product_id, created_at, _synced',
      saleLogs: 'id, sale_id, action, created_at, _synced',
    });
  }
}

export const db = new PosDatabase();

// ── Helpers ────────────────────────────────────────────────────────────────

export async function getActiveProducts(): Promise<Product[]> {
  return db.products
    .filter((p) => (p.active === true || (p.active as unknown) === 1) && p._deleted !== 1)
    .toArray();
}

export async function getProductByBarcode(barcode: string): Promise<Product | undefined> {
  return db.products
    .where('barcode')
    .equals(barcode)
    .and((p) => p.active === true && p._deleted !== 1)
    .first();
}

export async function getAllSales(): Promise<Sale[]> {
  return db.sales.orderBy('created_at').reverse().toArray();
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

export async function getAllSaleLogs(): Promise<SaleLog[]> {
  return db.saleLogs.orderBy('created_at').reverse().toArray();
}

export async function getUnsyncedSales(): Promise<Sale[]> {
  return db.sales.where('_synced').equals(0).toArray();
}

export async function getUnsyncedProducts(): Promise<Product[]> {
  return db.products.where('_synced').equals(0).toArray();
}

export async function getUnsyncedStockMovements(): Promise<StockMovement[]> {
  return db.stockMovements.where('_synced').equals(0).toArray();
}

export async function getUnsyncedPriceHistory(): Promise<PriceHistory[]> {
  return db.priceHistory.where('_synced').equals(0).toArray();
}

export async function getUnsyncedSaleLogs(): Promise<SaleLog[]> {
  return db.saleLogs.where('_synced').equals(0).toArray();
}
