import { create } from 'zustand';
import { db, getAllSales, getSalesInRange, getSaleItems } from '../lib/db';
import { syncInBackground } from '../lib/sync';
import { buildSale, buildSaleItems, calcCartTotals } from '../lib/calculations';
import { useProductStore } from './productStore';
import type { CartItem, Product, Sale, PaymentMethod } from '../types';

interface SaleStore {
  cart: CartItem[];
  lastSale: Sale | null;
  isProcessing: boolean;
  sales: Sale[];
  salesLoading: boolean;

  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (paymentMethod: PaymentMethod, amountPaid?: number) => Promise<Sale>;
  cartTotals: () => ReturnType<typeof calcCartTotals>;
  /** Pass null/null to load all sales without date filter. */
  loadSales: (from: Date | null, to: Date | null) => Promise<void>;
  cancelSale: (id: string, reason?: string) => Promise<void>;
  editSale: (id: string, updates: Partial<Pick<Sale, 'payment_method' | 'amount_paid' | 'notes'>>) => Promise<void>;
}

export const useSaleStore = create<SaleStore>((set, get) => ({
  cart: [],
  lastSale: null,
  isProcessing: false,
  sales: [],
  salesLoading: false,

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

  cancelSale: async (id, reason) => {
    const sale = await db.sales.get(id);
    if (!sale || sale.cancelled_at) return;

    const now = new Date().toISOString();
    await db.sales.update(id, {
      cancelled_at: now,
      cancellation_reason: reason ?? '',
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
        reason: `Cancelación de venta${reason ? ': ' + reason : ''}`,
        created_at: now,
        _synced: 0,
      });
    }

    syncInBackground();
    useProductStore.getState().fetchProducts();

    set((state) => ({
      sales: state.sales.map((s) =>
        s.id === id
          ? { ...s, cancelled_at: now, cancellation_reason: reason ?? '' }
          : s,
      ),
    }));
  },

  editSale: async (id, updates) => {
    const extra: Partial<Sale> = {};
    if (updates.amount_paid !== undefined) {
      const sale = await db.sales.get(id);
      if (sale) {
        extra.change_given = Math.max(0, updates.amount_paid - sale.total);
      }
    }
    await db.sales.update(id, { ...updates, ...extra, _synced: 0 });
    syncInBackground();
    set((state) => ({
      sales: state.sales.map((s) =>
        s.id === id ? { ...s, ...updates, ...extra } : s,
      ),
    }));
  },
}));
