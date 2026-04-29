import { supabase, isSupabaseConfigured } from './supabase';
import { db, getUnsyncedSales, getUnsyncedProducts } from './db';
import type { Product, Category, Sale, SaleItem } from '../types';

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: string;
}

async function pushSales(): Promise<{ pushed: number; error?: string }> {
  const unsynced = await getUnsyncedSales();
  if (!unsynced.length) return { pushed: 0 };

  let pushed = 0;
  for (const sale of unsynced) {
    const items = await db.saleItems.where('sale_id').equals(sale.id).toArray();
    const { _synced: _s, items: _i, ...saleData } = { ...sale, items };

    const { error } = await supabase.from('sales').upsert({ ...saleData, items: undefined });
    if (error) return { pushed, error: `sales: ${error.message}` };

    if (items.length) {
      const { error: itemErr } = await supabase.from('sale_items').upsert(items);
      if (itemErr) return { pushed, error: `sale_items: ${itemErr.message}` };
    }

    await db.sales.update(sale.id, { _synced: 1 });
    pushed++;
  }
  return { pushed };
}

async function pushProducts(): Promise<{ pushed: number; error?: string }> {
  const unsynced = await getUnsyncedProducts();
  if (!unsynced.length) return { pushed: 0 };

  let pushed = 0;
  for (const product of unsynced) {
    const { _synced: _s, _deleted: _d, category: _c, ...productData } = product as Product & {
      _synced?: number;
      _deleted?: number;
      category?: Category;
    };

    let error;
    if (product._deleted === 1) {
      ({ error } = await supabase.from('products').update({ active: false }).eq('id', product.id));
    } else {
      ({ error } = await supabase.from('products').upsert(productData));
    }

    if (error) return { pushed, error: `products: ${error.message}` };

    await db.products.update(product.id, { _synced: 1 });
    pushed++;
  }
  return { pushed };
}

async function pullProducts(): Promise<{ pulled: number; error?: string }> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('active', true)
    .order('name');

  if (error) return { pulled: 0, error: `products: ${error.message}` };
  if (!data) return { pulled: 0 };

  for (const product of data) {
    const local = await db.products.get(product.id);
    if (!local || local._synced === 1) {
      await db.products.put({ ...product, _synced: 1, _deleted: 0 });
    }
  }
  return { pulled: data.length };
}

async function pullCategories(): Promise<{ error?: string }> {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) return { error: `categories: ${error.message}` };
  if (!data) return {};
  for (const cat of data) {
    await db.categories.put(cat);
  }
  return {};
}

export async function runSync(): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, pushed: 0, pulled: 0, error: 'Supabase no configurado — revisá el archivo .env' };
  }

  try {
    const salesRes = await pushSales();
    if (salesRes.error) return { ok: false, pushed: salesRes.pushed, pulled: 0, error: salesRes.error };

    const productsRes = await pushProducts();
    if (productsRes.error) return { ok: false, pushed: salesRes.pushed + productsRes.pushed, pulled: 0, error: productsRes.error };

    const catsRes = await pullCategories();
    if (catsRes.error) return { ok: false, pushed: salesRes.pushed + productsRes.pushed, pulled: 0, error: catsRes.error };

    const pullRes = await pullProducts();
    if (pullRes.error) return { ok: false, pushed: salesRes.pushed + productsRes.pushed, pulled: 0, error: pullRes.error };

    return {
      ok: true,
      pushed: salesRes.pushed + productsRes.pushed,
      pulled: pullRes.pulled,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Error de sincronización';
    return { ok: false, pushed: 0, pulled: 0, error };
  }
}

export async function pullInitialData(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await pullCategories();
    await pullProducts();
  } catch {
    // offline – no-op
  }
}
