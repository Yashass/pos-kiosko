import { create } from 'zustand';
import { db, getAllSales, getSalesInRange, getSaleItems, getAllSaleLogs } from '../lib/db';
import { syncInBackground, pullSales, pullSaleLogs } from '../lib/sync';
import { buildSale, buildSaleItems, calcCartTotals } from '../lib/calculations';
import { useProductStore } from './productStore';
import type { CartItem, Product, Sale, SaleLog, PaymentMethod } from '../types';

interface SaleStore {
  cart: CartItem[];
  lastSale: Sale | null;
  isProcessing: boolean;
  sales: Sale[];
  salesLoading: boolean;
  saleLogs: SaleLog[];
  logsLoading: boolean;

  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (paymentMethod: PaymentMethod, amountPaid?: number) => Promise<Sale>;
  cartTotals: () => ReturnType<typeof calcCartTotals>;
  /** Pass null/null to load all sales without date filter. */
  loadSales: (from: Date | null, to: Date | null) => Promise<void>;
  loadLogs: () => Promise<void>;
  cancelSale: (id: string, reason: string) => Promise<void>;
  editSale: (id: string, updates: Partial<Pick<Sale, 'payment_method' | 'amount_paid' | 'notes'>>, auditNote: string) => Promise<void>;
}

export const useSaleStore = create<SaleStore>((set, get) => ({
  cart: [],
  lastSale: null,
  isProcessing: false,
  sales: [],
  salesLoading: false,
  saleLogs: [],
  logsLoading: false,

  addToCart: (product, quantity = 1) => {
    set((state) => {
      const existing = state.cart.find((i) => i.product.id === product.id);
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + quantity }
              : i,
          ),
        };
      }
      return {
        cart: [
          ...state.cart,
          { product, quantity, unit_price: product.price, unit_cost: product.cost },
        ],
      };
    });
  },

  removeFromCart: (productId) => {
    set((state) => ({ cart: state.cart.filter((i) => i.product.id !== productId) }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    set((state) => ({
      cart: state.cart.map((i) =>
        i.product.id === productId ? { ...i, quantity } : i,
      ),
    }));
  },

  clearCart: () => set({ cart: [] }),

  cartTotals: () => calcCartTotals(get().cart),

  checkout: async (paymentMethod, amountPaid) => {
    set({ isProcessing: true });
    const { cart } = get();
    if (!cart.length) throw new Error('El carrito está vacío');

    try {
      const sale = buildSale(cart, paymentMethod, amountPaid);
      const saleItems = buildSaleItems(cart, sale.id);

      await db.sales.add(sale);
      await db.saleItems.bulkAdd(saleItems);

      for (const item of cart) {
        const product = await db.products.get(item.product.id);
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          await db.products.update(item.product.id, {
            stock: newStock,
            updated_at: new Date().toISOString(),
            _synced: 0,
          });
          await db.stockMovements.add({
            id: crypto.randomUUID(),
            product_id: item.product.id,
            type: 'venta' as const,
            quantity: -item.quantity,
            previous_stock: product.stock,
            new_stock: newStock,
            created_at: new Date().toISOString(),
            _synced: 0,
          });
        }
      }

      syncInBackground();

      const fullSale: Sale = { ...sale, items: saleItems };
      set({ cart: [], lastSale: fullSale, isProcessing: false });
      return fullSale;
    } catch (e) {
      set({ isProcessing: false });
      throw e;
    }
  },

  loadSales: async (from, to) => {
    set({ salesLoading: true });
    try {
      // Pull from Supabase first so history is up-to-date on any device
      await pullSales(from ?? undefined, to ?? undefined);

      const raw = from && to ? await getSalesInRange(from, to) : await getAllSales();
      const withItems = await Promise.all(
        raw.map(async (sale) => ({ ...sale, items: await getSaleItems(sale.id) })),
      );
      // getAllSales already returns DESC; getSalesInRange does not guarantee order
      if (from && to) withItems.sort((a, b) => b.created_at.localeCompare(a.created_at));
      set({ sales: withItems, salesLoading: false });
    } catch {
      set({ salesLoading: false });
    }
  },

  loadLogs: async () => {
    set({ logsLoading: true });
    try {
      // Pull from Supabase first to get logs from other devices
      await pullSaleLogs();
      const logs = await getAllSaleLogs();
      set({ saleLogs: logs, logsLoading: false });
    } catch {
      set({ logsLoading: false });
    }
  },

  cancelSale: async (id, reason) => {
    const sale = await db.sales.get(id);
    if (!sale || sale.cancelled_at) return;

    const now = new Date().toISOString();
    await db.sales.update(id, {
      cancelled_at: now,
      cancellation_reason: reason,
      _synced: 0,
    });

    const items = await db.saleItems.where('sale_id').equals(id).toArray();
    for (const item of items) {
      if (!item.product_id) continue;
      const product = await db.products.get(item.product_id);
      if (!product) continue;
      const newStock = product.stock + item.quantity;
      await db.products.update(item.product_id, {
        stock: newStock,
        updated_at: now,
        _synced: 0,
      });
      await db.stockMovements.add({
        id: crypto.randomUUID(),
        product_id: item.product_id,
        type: 'devolucion' as const,
        quantity: item.quantity,
        previous_stock: product.stock,
        new_stock: newStock,
        reason: `Cancelación de venta: ${reason}`,
        created_at: now,
        _synced: 0,
      });
    }

    // Audit log
    await db.saleLogs.add({
      id: crypto.randomUUID(),
      sale_id: id,
      action: 'cancel',
      changes: JSON.stringify([]),
      note: reason,
      created_at: now,
      _synced: 0,
    });

    syncInBackground();
    useProductStore.getState().fetchProducts();

    set((state) => ({
      sales: state.sales.map((s) =>
        s.id === id
          ? { ...s, cancelled_at: now, cancellation_reason: reason }
          : s,
      ),
    }));
  },

  editSale: async (id, updates, auditNote) => {
    const sale = await db.sales.get(id);
    if (!sale) return;

    // Build change entries for the audit trail
    const changes: { field: string; old: string; new: string }[] = [];
    if (updates.payment_method && updates.payment_method !== sale.payment_method) {
      changes.push({ field: 'Método de pago', old: sale.payment_method, new: updates.payment_method });
    }
    if (updates.amount_paid !== undefined && updates.amount_paid !== sale.amount_paid) {
      changes.push({ field: 'Monto cobrado', old: String(sale.amount_paid ?? 0), new: String(updates.amount_paid) });
    }
    if (updates.notes !== undefined && updates.notes !== sale.notes) {
      changes.push({ field: 'Notas', old: sale.notes ?? '', new: updates.notes ?? '' });
    }

    const extra: Partial<Sale> = {};
    if (updates.amount_paid !== undefined) {
      extra.change_given = Math.max(0, updates.amount_paid - sale.total);
    }

    await db.sales.update(id, { ...updates, ...extra, _synced: 0 });

    // Audit log
    await db.saleLogs.add({
      id: crypto.randomUUID(),
      sale_id: id,
      action: 'edit',
      changes: JSON.stringify(changes),
      note: auditNote,
      created_at: new Date().toISOString(),
      _synced: 0,
    });

    syncInBackground();
    set((state) => ({
      sales: state.sales.map((s) =>
        s.id === id ? { ...s, ...updates, ...extra } : s,
      ),
    }));
  },
}));
