import { create } from 'zustand';
import { db, getActiveProducts } from '../lib/db';
import { syncInBackground } from '../lib/sync';
import type { Product, Category, BulkUpdateOptions } from '../types';
import { applyPercentage } from '../lib/calculations';

interface ProductStore {
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string | null;

  fetchProducts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | '_synced' | '_deleted'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkUpdatePrices: (productIds: string[], options: BulkUpdateOptions) => Promise<void>;
  updateStock: (productId: string, delta: number, type: 'compra' | 'ajuste' | 'devolucion', reason?: string) => Promise<void>;
  getProductById: (id: string) => Product | undefined;
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  categories: [],
  loading: false,
  error: null,

  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const products = await getActiveProducts();
      const categories = await db.categories.toArray();
      const withCategory = products.map((p) => ({
        ...p,
        category: categories.find((c) => c.id === p.category_id),
      }));
      set({ products: withCategory, categories, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchCategories: async () => {
    const categories = await db.categories.toArray();
    set({ categories });
  },

  addProduct: async (productData) => {
    const now = new Date().toISOString();
    const product: Product = {
      ...productData,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      _synced: 0,
      _deleted: 0,
    };
    await db.products.add(product);
    await get().fetchProducts();

    // Sync immediately in background; if offline it stays _synced:0 and
    // useSync retries automatically when connection is restored.
    syncInBackground();

    return product;
  },

  updateProduct: async (id, updates) => {
    const now = new Date().toISOString();
    await db.products.update(id, { ...updates, updated_at: now, _synced: 0 });
    await get().fetchProducts();
    syncInBackground();
  },

  deleteProduct: async (id) => {
    await db.products.update(id, { active: false, _synced: 0, _deleted: 1 });
    await get().fetchProducts();
    syncInBackground();
  },

  bulkUpdatePrices: async (productIds, options) => {
    const products = get().products.filter((p) => productIds.includes(p.id));
    const now = new Date().toISOString();
    const priceHistoryRecords = [];

    for (const product of products) {
      const updates: Partial<Product> = { updated_at: now, _synced: 0 };
      const historyEntry = {
        id: crypto.randomUUID(),
        product_id: product.id,
        old_cost: product.cost,
        new_cost: product.cost,
        old_price: product.price,
        new_price: product.price,
        change_pct: options.percentage,
        reason: `Actualización masiva: ${options.field} ${options.percentage > 0 ? '+' : ''}${options.percentage}%`,
        created_at: now,
        _synced: 0,
      };

      if (options.field === 'cost' || options.field === 'both') {
        updates.cost = applyPercentage(product.cost, options.percentage);
        historyEntry.new_cost = updates.cost;
      }
      if (options.field === 'price' || options.field === 'both') {
        updates.price = applyPercentage(product.price, options.percentage);
        historyEntry.new_price = updates.price;
      }
      if (options.field === 'cost' && options.recalculatePrice) {
        const margin = (product.price - product.cost) / product.cost;
        updates.price = (updates.cost ?? product.cost) * (1 + margin);
        historyEntry.new_price = updates.price;
      }

      await db.products.update(product.id, updates);
      priceHistoryRecords.push(historyEntry);
    }

    await db.priceHistory.bulkAdd(priceHistoryRecords);
    await get().fetchProducts();
    syncInBackground();
  },

  updateStock: async (productId, delta, type, reason) => {
    const product = await db.products.get(productId);
    if (!product) return;

    const previousStock = product.stock;
    const newStock = Math.max(0, previousStock + delta);

    await db.products.update(productId, {
      stock: newStock,
      updated_at: new Date().toISOString(),
      _synced: 0,
    });

    await db.stockMovements.add({
      id: crypto.randomUUID(),
      product_id: productId,
      type,
      quantity: delta,
      previous_stock: previousStock,
      new_stock: newStock,
      reason: reason ?? '',
      created_at: new Date().toISOString(),
      _synced: 0,
    });

    await get().fetchProducts();
    syncInBackground();
  },

  getProductById: (id) => get().products.find((p) => p.id === id),
}));
