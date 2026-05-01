-- ============================================================
-- POS Kiosco - Supabase Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name, color) VALUES
  ('General', '#6366f1'),
  ('Bebidas', '#0ea5e9'),
  ('Snacks', '#f59e0b'),
  ('Golosinas', '#ec4899'),
  ('Cigarrillos', '#64748b'),
  ('Lácteos', '#22c55e');

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  barcode TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 21, -- IVA % (ej: 21 = 21%)
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 3,
  unit TEXT DEFAULT 'unidad',
  entry_date DATE DEFAULT CURRENT_DATE,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX products_barcode_idx ON products(barcode) WHERE barcode IS NOT NULL AND barcode != '';
CREATE INDEX products_name_idx ON products USING gin(to_tsvector('spanish', name));

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subtotal NUMERIC(12,2) NOT NULL,       -- suma de (price * qty) de cada item
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0, -- impuesto total (IVA incluido en precio)
  total NUMERIC(12,2) NOT NULL,           -- lo que paga el cliente
  cost_total NUMERIC(12,2) NOT NULL DEFAULT 0, -- costo total de los items vendidos
  profit_gross NUMERIC(12,2) NOT NULL DEFAULT 0,      -- ganancia bruta (price - cost)
  profit_net NUMERIC(12,2) NOT NULL DEFAULT 0,        -- ganancia neta (sin impuesto)
  payment_method TEXT NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo','tarjeta','transferencia','mixto')),
  amount_paid NUMERIC(12,2),
  change_given NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX sales_created_at_idx ON sales(created_at);

-- ============================================================
-- SALE ITEMS
-- ============================================================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_barcode TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX sale_items_sale_id_idx ON sale_items(sale_id);
CREATE INDEX sale_items_product_id_idx ON sale_items(product_id);

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('compra','venta','ajuste','devolucion')),
  quantity INTEGER NOT NULL,        -- positivo = entrada, negativo = salida
  previous_stock INTEGER NOT NULL DEFAULT 0,
  new_stock INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  unit_cost NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX stock_movements_product_id_idx ON stock_movements(product_id);
CREATE INDEX stock_movements_created_at_idx ON stock_movements(created_at);

-- ============================================================
-- PRICE HISTORY
-- ============================================================
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_cost NUMERIC(12,2),
  new_cost NUMERIC(12,2),
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2),
  change_pct NUMERIC(6,2),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (básico - un solo negocio)
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso anónimo con anon key (para uso offline)
CREATE POLICY "allow_all_categories" ON categories FOR ALL USING (true);
CREATE POLICY "allow_all_products" ON products FOR ALL USING (true);
CREATE POLICY "allow_all_sales" ON sales FOR ALL USING (true);
CREATE POLICY "allow_all_sale_items" ON sale_items FOR ALL USING (true);
CREATE POLICY "allow_all_stock_movements" ON stock_movements FOR ALL USING (true);
CREATE POLICY "allow_all_price_history" ON price_history FOR ALL USING (true);

-- ============================================================
-- MIGRATION: Add cancellation fields to sales
-- Run this if the table already exists
-- ============================================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
