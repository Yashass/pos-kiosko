import { supabase, isSupabaseConfigured } from './supabase';
import { db, getUnsyncedSales, getUnsyncedProducts } from './db';
import type { Product, Category, Sale, SaleItem } from '../types';

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: string;
}

async function pushSales(): Promise<number> {
  const unsynced = await getUnsyncedSales();
  if (!unsynced.length) return 0;

  let pushed = 0;
  for (const sale of unsynced) {
    const items = await db.saleItems.where('sale_id').equals(sale.id).toArray();

    const { _synced: _s, items: _i, ...saleData } = { ...sale, items };
    const { error } = await supabase.from('sales').upsert({
      ...saleData,
      items: undefined,
    });

    if (!error) {
      if (items.length) {
        await supabase.from('sale_items').upsert(items);
      }
      await db.sales.update(sale.id, { _synced: 1 });
      pushed++;
    }
  }
  return pushed;
}

async function pushProducts(): Promise<number> {
  const unsynced = await getUnsyncedProducts();
  if (!unsynced.length) return 0;

  let pushed = 0;
  for (const product of unsynced) {
    const { _synced: _s, _deleted: _d, category: _c, ...productData } = product as Product & {
      _synced?: number;
      _deleted?: number;
      category?: Category;
    };

    if (product._deleted === 1) {
      await supabase.from('products').update({ active: false }).eq('id', product.id);
    } else {
      await supabase.from('products').upsert(productData);
    }

    await db.products.update(product.id, { _synced: 1 });
    pushed++;
  }
  return pushed;
}

async function pullProducts(): Promise<number> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('active', true)
    .order('name');

  if (error || !data) return 0;

  for (const product of data) {
    const local = await db.products.get(product.id);
    if (!local || local._synced === 1) {
      await db.products.put({
        ...product,
        _synced: 1,
        _deleted: 0,
      });
    }
  }
  return data.length;
}

async function pullCategories(): Promise<void> {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error || !data) return;
  for (const cat of data) {
    await db.categories.put(cat);
  }
}

export async function runSync(): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, pushed: 0, pulled: 0, error: 'Supabase no configurado' };
  }

  try {
    const [pushedSales, pushedProducts] = await Promise.all([pushSales(), pushProducts()]);
    await pullCategories();
    const pulled = await pullProducts();

    return { ok: true, pushed: pushedSales + pushedProducts, pulled };
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
