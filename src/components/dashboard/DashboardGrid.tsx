import { useState, useCallback } from 'react';
import GridLayout, { type Layout } from 'react-grid-layout';
import { Settings, RotateCcw, Save, X, GripVertical } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useWindowSize } from '../../hooks/useWindowSize';
import type { WidgetId } from '../../types';
import NetProfitWidget from './widgets/NetProfitWidget';
import StockWidget from './widgets/StockWidget';
import ProductRankingWidget from './widgets/ProductRankingWidget';
import DailySalesWidget from './widgets/DailySalesWidget';
import RecentSalesWidget from './widgets/RecentSalesWidget';
import toast from 'react-hot-toast';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const WIDGET_COMPONENTS: Record<WidgetId, React.ComponentType> = {
  net_profit: NetProfitWidget,
  stock_summary: StockWidget,
  product_ranking: ProductRankingWidget,
  daily_sales: DailySalesWidget,
  recent_sales: RecentSalesWidget,
};

const WIDGET_LABELS: Record<WidgetId, string> = {
  net_profit: 'Ganancia Neta',
  stock_summary: 'Stock',
  product_ranking: 'Ranking de Productos',
  daily_sales: 'Ventas por Día',
  recent_sales: 'Ventas Recientes',
};

const ROW_HEIGHT = 120;
const COLS = 12;

export default function DashboardGrid() {
  const { widgets, savedWidgets, setWidgets, toggleWidget, saveLayout, resetLayout } = useDashboardStore();
  const [configOpen, setConfigOpen] = useState(false);
  const { width } = useWindowSize();

  const containerWidth = Math.max((width ?? 800) - 32, 300);
  const isMobile = containerWidth < 600;

  const enabledWidgets = widgets.filter((w) => w.enabled);

  const hasUnsavedChanges = JSON.stringify(widgets) !== JSON.stringify(savedWidgets);

  const layout: Layout[] = enabledWidgets.map((w) => ({
    i: w.id,
    x: isMobile ? 0 : w.x,
    y: w.y,
    w: isMobile ? COLS : w.w,
    h: w.h,
    minW: isMobile ? COLS : (w.minW ?? 2),
    minH: w.minH ?? 2,
  }));

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      const updated = widgets.map((w) => {
        const match = newLayout.find((l) => l.i === w.id);
        if (!match) return w;
        return { ...w, x: match.x, y: match.y, w: match.w, h: match.h };
      });
      setWidgets(updated);
    },
    [widgets, setWidgets],
  );

  function handleSave() {
    saveLayout();
    toast.success('Diseño guardado');
  }

  function handleReset() {
    resetLayout();
    toast('Diseño restablecido al último guardado', { icon: '↩️' });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConfigOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Settings size={15} />
          <span>Personalizar</span>
        </button>

        {!isMobile && (
          <>
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                hasUnsavedChanges
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  : 'text-slate-400 border-slate-200 cursor-default'
              }`}
              disabled={!hasUnsavedChanges}
              title="Guardar diseño actual"
            >
              <Save size={15} />
              <span>Guardar</span>
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Restablecer al último diseño guardado"
            >
              <RotateCcw size={15} />
            </button>
          </>
        )}
      </div>

      {/* Grid */}
      <GridLayout
        layout={layout}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        width={containerWidth}
        draggableHandle=".drag-handle"
        onLayoutChange={handleLayoutChange}
        isResizable={!isMobile}
        isDraggable={!isMobile}
        margin={[12, 12]}
      >
        {enabledWidgets.map((w) => {
          const Component = WIDGET_COMPONENTS[w.id];
          return (
            <div
              key={w.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="drag-handle flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50 cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-1.5">
                  <GripVertical size={13} className="text-slate-300" />
                  <span className="text-xs font-medium text-slate-500">{WIDGET_LABELS[w.id]}</span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <Component />
              </div>
            </div>
          );
        })}
      </GridLayout>

      {/* Config modal */}
      {configOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-slate-800">Personalizar Dashboard</h3>
              <button onClick={() => setConfigOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-2">
              <p className="text-xs text-slate-500 mb-3">
                Activá o desactivá los widgets. En desktop podés arrastrarlos y redimensionarlos.
              </p>
              {widgets.map((w) => (
                <label key={w.id} className="flex items-center gap-3 py-2 cursor-pointer">
                  <div
                    className={`w-10 h-5 rounded-full transition-colors relative ${w.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                    onClick={() => toggleWidget(w.id)}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${w.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                    />
                  </div>
                  <span className={`text-sm ${w.enabled ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {WIDGET_LABELS[w.id]}
                  </span>
                </label>
              ))}
            </div>
            <div className="px-5 py-4 border-t flex gap-2">
              <button
                onClick={() => { handleReset(); setConfigOpen(false); }}
                className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={13} />
                Restablecer
              </button>
              <button
                onClick={() => { handleSave(); setConfigOpen(false); }}
                className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-1.5"
              >
                <Save size={13} />
                Guardar y cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
