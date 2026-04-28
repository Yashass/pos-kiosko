import { create } from 'zustand';
import { db } from '../lib/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { buildSale, buildSaleItems, calcCartTotals } from '../lib/calculations';
import type { CartItem, Product, Sale, PaymentMethod } from '../types';

interface SaleStore {
  cart: CartItem[];
  lastSale: Sale | null;
  isProcessing: boolean;

  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (paymentMethod: PaymentMethod, amountPaid?: number) => Promise<Sale>;
  cartTotals: () => ReturnType<typeof calcCartTotals>;
}

export const useSaleStore = create<SaleStore>((set, get) => ({
  cart: [],
  lastSale: null,
  isProcessing: false,

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

      // Descontar stock
      for (const item of cart) {
        const product = await db.products.get(item.product.id);
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          const movement = {
            id: crypto.randomUUID(),
            product_id: item.product.id,
            type: 'venta' as const,
            quantity: -item.quantity,
            previous_stock: product.stock,
            new_stock: newStock,
            created_at: new Date().toISOString(),
          };
          await db.products.update(item.product.id, {
            stock: newStock,
            updated_at: new Date().toISOString(),
            _synced: 0,
          });
          await db.stockMovements.add(movement);
        }
      }

      // Sync en background
      if (isSupabaseConfigured()) {
        Promise.all([
          supabase.from('sales').insert({
            ...sale,
            _synced: undefined,
          }),
          supabase.from('sale_items').insert(saleItems),
        ])
          .then(async ([saleRes]) => {
            if (!saleRes.error) {
              await db.sales.update(sale.id, { _synced: 1 });
            }
          })
          .catch(() => {});
      }

      const fullSale: Sale = { ...sale, items: saleItems };
      set({ cart: [], lastSale: fullSale, isProcessing: false });
      return fullSale;
    } catch (e) {
      set({ isProcessing: false });
      throw e;
    }
  },
}));
