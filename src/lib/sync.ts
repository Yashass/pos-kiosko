import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  db,
  getUnsyncedSales,
  getUnsyncedProducts,
  getUnsyncedStockMovements,
  getUnsyncedPriceHistory,
  getUnsyncedSaleLogs,
} from './db';
import type { Product, Category, Sale, SaleItem } from '../types';

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
      continue;
    }

    await db.products.update(product.id, { _synced: 1 });
    pushed++;
  }

  return errors.length ? { pushed, error: errors.join(' | ') } : { pushed };
}

async function pushStockMovements(): Promise<{ pushed: number; error?: string }> {
  const unsynced = await getUnsyncedStockMovements();
  if (!unsynced.length) return { pushed: 0 };

  let pushed = 0;
  const errors: string[] = [];

  for (const movement of unsynced) {
    const { _synced: _s, ...data } = movement;
    const { error } = await supabase.from('stock_movements').upsert(data);
    if (error) { errors.push(error.message); continue; }
    await db.stockMovements.update(movement.id, { _synced: 1 });
    pushed++;
  }

  return errors.length ? { pushed, error: errors.join(' | ') } : { pushed };
}

async function pushPriceHistory(): Promise<{ pushed: number; error?: string }> {
  const unsynced = await getUnsyncedPriceHistory();
  if (!unsynced.length) return { pushed: 0 };

  let pushed = 0;
  const errors: string[] = [];

  for (const record of unsynced) {
    const { _synced: _s, ...data } = record;
    const { error } = await supabase.from('price_history').upsert(data);
    if (error) { errors.push(error.message); continue; }
    await db.priceHistory.update(record.id, { _synced: 1 });
    pushed++;
  }

  return errors.length ? { pushed, error: errors.join(' | ') } : { pushed };
}

async function pushSaleLogs(): Promise<{ pushed: number; error?: string }> {
  const unsynced = await getUnsyncedSaleLogs();
  if (!unsynced.length) return { pushed: 0 };

  let pushed = 0;
  const errors: string[] = [];

  for (const log of unsynced) {
    const { _synced: _s, ...data } = log;
    const { error } = await supabase.from('sale_logs').upsert(data);
    if (error) { errors.push(error.message); continue; }
    await db.saleLogs.update(log.id, { _synced: 1 });
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

/** Pull sales from Supabase into IndexedDB. Skips records with unsynced local changes. */
export async function pullSales(from?: Date, to?: Date): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('sales')
      .select('*, sale_items(*)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (from) query = query.gte('created_at', from.toISOString());
    if (to) query = query.lte('created_at', to.toISOString());

    const { data, error } = await query;
    if (error || !data) return;

    for (const row of data as (Sale & { sale_items?: SaleItem[] })[]) {
      const { sale_items: remoteItems, ...saleData } = row as Sale & { sale_items?: SaleItem[] };

      // Don't overwrite locally modified (unsynced) records
      const local = await db.sales.get(saleData.id);
      if (local?._synced === 0) continue;

      await db.sales.put({ ...saleData, _synced: 1 });

      if (remoteItems?.length) {
        for (const item of remoteItems) {
          const localItem = await db.saleItems.get(item.id);
          if (!localItem) {
            await db.saleItems.put(item);
          }
        }
      }
    }
  } catch {
    // offline – no-op
  }
}

/** Pull sale_logs from Supabase into IndexedDB (only inserts missing records). */
export async function pullSaleLogs(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { data, error } = await supabase
      .from('sale_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !data) return;

    for (const log of data) {
      const local = await db.saleLogs.get(log.id);
      if (!local) {
        await db.saleLogs.put({ ...log, _synced: 1 });
      }
    }
  } catch {
    // offline – no-op
  }
}

export async function runSync(): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, pushed: 0, pulled: 0, error: 'Supabase no configurado — revisá el archivo .env' };
  }

  if (syncInProgress) {
    return { ok: true, pushed: 0, pulled: 0 };
  }

  syncInProgress = true;

  try {
    const salesRes = await pushSales();
    const productsRes = await pushProducts();
    const stockRes = await pushStockMovements();
    const priceRes = await pushPriceHistory();
    const logsRes = await pushSaleLogs();
    const catsRes = await pullCategories();
    const pullRes = await pullProducts();

    const pushed = salesRes.pushed + productsRes.pushed + stockRes.pushed + priceRes.pushed + logsRes.pushed;
    const firstError =
      salesRes.error ?? productsRes.error ?? stockRes.error ?? priceRes.error ??
      logsRes.error ?? catsRes.error ?? pullRes.error;

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

/** Fire-and-forget sync. Shows a toast only on error (not on "not configured"). */
export function syncInBackground() {
  runSync().then((result) => {
    if (!result.ok && result.error && !result.error.includes('no configurado')) {
      toast.error(`Error al sincronizar: ${result.error}`, { duration: 5000, id: 'sync-error' });
    }
  }).catch(() => {});
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
