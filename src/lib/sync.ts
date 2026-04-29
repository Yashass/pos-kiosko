import { supabase, isSupabaseConfigured } from './supabase';
import { db, getUnsyncedSales, getUnsyncedProducts } from './db';
import type { Product, Category } from '../types';

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: string;
}

// Guard against concurrent syncs
let syncInProgress = false;

/** Strip local-only fields and normalize values before sending to Supabase. */
function toSupabaseProduct(product: Product & { _synced?: number; _deleted?: number; category?: Category }) {
  const { _synced: _s, _deleted: _d, category: _c, ...data } = product;
  return {
    ...data,
    // Empty string is not a valid UUID — PostgreSQL requires null or a valid UUID
    category_id: data.category_id || null,
  };
}

async function pushSales(): Promise<{ pushed: number; error?: string }> {
  const unsynced = await getUnsyncedSales();
  if (!unsynced.length) return { pushed: 0 };

  let pushed = 0;
  const errors: string[] = [];

  for (const sale of unsynced) {
    const items = await db.saleItems.where('sale_id').equals(sale.id).toArray();
    const { _synced: _s, items: _i, ...saleData } = { ...sale, items };

    const { error } = await supabase.from('sales').upsert({ ...saleData, items: undefined });
    if (error) { errors.push(`sales: ${error.message}`); continue; }

    if (items.length) {
      const { error: itemErr } = await supabase.from('sale_items').upsert(items);
      if (itemErr) { errors.push(`sale_items: ${itemErr.message}`); continue; }
    }

    await db.sales.update(sale.id, { _synced: 1 });
    pushed++;
  }

  return errors.length ? { pushed, error: errors[0] } : { pushed };
}

async function pushProducts(): Promise<{ pushed: number; error?: string }> {
  const unsynced = await getUnsyncedProducts();
  if (!unsynced.length) return { pushed: 0 };

  let pushed = 0;
  const errors: string[] = [];

  for (const product of unsynced) {
    let supabaseError;

    if (product._deleted === 1) {
      ({ error: supabaseError } = await supabase
        .from('products')
        .update({ active: false })
        .eq('id', product.id));
    } else {
      ({ error: supabaseError } = await supabase
        .from('products')
        .upsert(toSupabaseProduct(product)));
    }

    if (supabaseError) {
      errors.push(`"${product.name}": ${supabaseError.message}`);
      continue; // try remaining products instead of aborting
    }

    await db.products.update(product.id, { _synced: 1 });
    pushed++;
  }

  return errors.length ? { pushed, error: errors.join(' | ') } : { pushed };
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
    // Only overwrite if record doesn't exist locally or is already synced
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

  if (syncInProgress) {
    return { ok: true, pushed: 0, pulled: 0 }; // another sync is already running
  }

  syncInProgress = true;

  try {
    const salesRes = await pushSales();
    const productsRes = await pushProducts();
    const catsRes = await pullCategories();
    const pullRes = await pullProducts();

    const pushed = salesRes.pushed + productsRes.pushed;
    const firstError = salesRes.error ?? productsRes.error ?? catsRes.error ?? pullRes.error;

    return {
      ok: !firstError,
      pushed,
      pulled: pullRes.pulled,
      error: firstError,
    };
  } catch (e) {
    return { ok: false, pushed: 0, pulled: 0, error: e instanceof Error ? e.message : 'Error de sincronización' };
  } finally {
    syncInProgress = false;
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
