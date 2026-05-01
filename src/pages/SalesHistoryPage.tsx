import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  format,
  startOfDay, endOfDay,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  subWeeks, subMonths,
  getISOWeek, getYear,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronDown, ChevronUp, Edit3, XCircle,
  Receipt, TrendingUp, ShoppingBag, AlertCircle, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSaleStore } from '../stores/saleStore';
import type { Sale } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

type FilterMode = 'todos' | 'semana' | 'mes' | 'rango';

interface PeriodOption { value: string; label: string; from: Date; to: Date; }

// ── Helpers ────────────────────────────────────────────────────────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0,
  }).format(n);
}

function buildWeekOptions(): PeriodOption[] {
  const now = new Date();
  return Array.from({ length: 16 }, (_, i) => {
    const d = subWeeks(now, i);
    const from = startOfWeek(d, { weekStartsOn: 1 });
    const to = endOfWeek(d, { weekStartsOn: 1 });
    const week = getISOWeek(d);
    const year = getYear(d);
    return {
      value: `${year}-W${String(week).padStart(2, '0')}`,
      label: `Sem ${week} · ${format(from, 'd MMM', { locale: es })} – ${format(to, 'd MMM yyyy', { locale: es })}`,
      from,
      to,
    };
  });
}

function buildMonthOptions(): PeriodOption[] {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const d = subMonths(now, i);
    return {
      value: format(d, 'yyyy-MM'),
      label: cap(format(d, 'MMMM yyyy', { locale: es })),
      from: startOfMonth(d),
      to: endOfMonth(d),
    };
  });
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta',
  transferencia: 'Transferencia', mixto: 'Mixto',
};
const PAYMENT_COLORS: Record<string, string> = {
  efectivo: 'bg-emerald-900/40 text-emerald-400',
  tarjeta: 'bg-blue-900/40 text-blue-400',
  transferencia: 'bg-purple-900/40 text-purple-400',
  mixto: 'bg-amber-900/40 text-amber-400',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function SalesHistoryPage() {
  const { sales, salesLoading, loadSales, cancelSale, editSale } = useSaleStore();

  const weekOptions = useMemo(() => buildWeekOptions(), []);
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [mode, setMode] = useState<FilterMode>('todos');
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[0].value);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [rangeFrom, setRangeFrom] = useState(todayStr);
  const [rangeTo, setRangeTo] = useState(todayStr);
  const [pendingRange, setPendingRange] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [cancelling, setCancelling] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [editForm, setEditForm] = useState({ payment_method: '', amount_paid: '', notes: '' });
  const [isSaving, setIsSaving] = useState(false);

  const getRange = useCallback((): [Date | null, Date | null] => {
    if (mode === 'todos') return [null, null];
    if (mode === 'semana') {
      const opt = weekOptions.find((w) => w.value === selectedWeek);
      return opt ? [opt.from, opt.to] : [null, null];
    }
    if (mode === 'mes') {
      const opt = monthOptions.find((m) => m.value === selectedMonth);
      return opt ? [opt.from, opt.to] : [null, null];
    }
    if (!rangeFrom || !rangeTo) return [null, null];
    return [startOfDay(parseISO(rangeFrom)), endOfDay(parseISO(rangeTo))];
  }, [mode, selectedWeek, selectedMonth, rangeFrom, rangeTo, weekOptions, monthOptions]);

  const reload = useCallback(() => {
    const [from, to] = getRange();
    loadSales(from, to);
    setPendingRange(false);
  }, [getRange, loadSales]);

  useEffect(() => {
    if (mode !== 'rango') reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedWeek, selectedMonth]);

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSales = sales.filter((s) => !s.cancelled_at);
  const totalRevenue = activeSales.reduce((acc, s) => acc + s.total, 0);
  const totalProfit = activeSales.reduce((acc, s) => acc + s.profit_net, 0);

  function openEdit(sale: Sale) {
    setEditing(sale);
    setEditForm({
      payment_method: sale.payment_method,
      amount_paid: sale.amount_paid?.toString() ?? '',
      notes: sale.notes ?? '',
    });
  }

  async function handleEdit() {
    if (!editing) return;
    setIsSaving(true);
    try {
      await editSale(editing.id, {
        payment_method: editForm.payment_method as Sale['payment_method'],
        amount_paid: editForm.amount_paid ? parseFloat(editForm.amount_paid) : undefined,
        notes: editForm.notes || undefined,
      });
      toast.success('Venta actualizada');
      setEditing(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancel() {
    if (!cancelling) return;
    setIsSaving(true);
    try {
      await cancelSale(cancelling.id, cancelReason || undefined);
      toast.success('Venta cancelada — stock revertido');
      setCancelling(null);
      setCancelReason('');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-100">Historial de Ventas</h1>
        <button
          onClick={reload}
          disabled={salesLoading}
          className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          title="Actualizar"
        >
          <RefreshCw size={16} className={salesLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter mode tabs */}
      <div className="flex bg-zinc-800 rounded-lg p-1 mb-3 gap-1 overflow-x-auto">
        {(['todos', 'semana', 'mes', 'rango'] as FilterMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setExpandedId(null); }}
            className={`flex-1 min-w-fit py-1.5 px-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              mode === m ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {m === 'todos' ? 'Todos' : m === 'semana' ? 'Semana' : m === 'mes' ? 'Mes' : 'Rango'}
          </button>
        ))}
      </div>

      {/* Sub-controls */}
      {mode === 'semana' && (
        <div className="mb-3">
          <select
            value={selectedWeek}
            onChange={(e) => { setSelectedWeek(e.target.value); setExpandedId(null); }}
            className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-zinc-100"
          >
            {weekOptions.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
      )}

      {mode === 'mes' && (
        <div className="mb-3">
          <select
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(e.target.value); setExpandedId(null); }}
            className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-zinc-100"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {mode === 'rango' && (
        <div className="flex gap-2 mb-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-zinc-500 mb-1">Desde</label>
            <input
              type="date"
              value={rangeFrom}
              max={rangeTo || todayStr}
              onChange={(e) => { setRangeFrom(e.target.value); setPendingRange(true); }}
              className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-zinc-100"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-zinc-500 mb-1">Hasta</label>
            <input
              type="date"
              value={rangeTo}
              min={rangeFrom}
              max={todayStr}
              onChange={(e) => { setRangeTo(e.target.value); setPendingRange(true); }}
              className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-zinc-100"
            />
          </div>
          <button
            onClick={() => { setExpandedId(null); reload(); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              pendingRange
                ? 'bg-red-700 text-white hover:bg-red-800'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Buscar
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-zinc-900 rounded-xl p-3 shadow-sm border border-zinc-800">
          <div className="flex items-center gap-1.5 mb-1">
            <ShoppingBag size={13} className="text-red-500" />
            <span className="text-xs text-zinc-500">Ventas</span>
          </div>
          <p className="text-xl font-bold text-zinc-100">{activeSales.length}</p>
          {sales.length !== activeSales.length && (
            <p className="text-xs text-zinc-500">{sales.length - activeSales.length} cancel.</p>
          )}
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 shadow-sm border border-zinc-800">
          <div className="flex items-center gap-1.5 mb-1">
            <Receipt size={13} className="text-emerald-500" />
            <span className="text-xs text-zinc-500">Ingresos</span>
          </div>
          <p className="text-sm font-bold text-zinc-100 leading-tight">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 shadow-sm border border-zinc-800">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} className="text-purple-400" />
            <span className="text-xs text-zinc-500">Ganancia</span>
          </div>
          <p className="text-sm font-bold text-zinc-100 leading-tight">{formatCurrency(totalProfit)}</p>
        </div>
      </div>

      {/* Sales list */}
      {salesLoading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">Cargando…</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">No hay ventas en este período</div>
      ) : (
        <div className="space-y-2">
          {sales.map((sale) => {
            const isExpanded = expandedId === sale.id;
            const isCancelled = !!sale.cancelled_at;
            return (
              <div
                key={sale.id}
                className={`bg-zinc-900 rounded-xl shadow-sm border overflow-hidden ${
                  isCancelled ? 'border-red-900 opacity-60' : 'border-zinc-800'
                }`}
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-100">
                        {format(new Date(sale.created_at), 'HH:mm', { locale: es })}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {format(new Date(sale.created_at), 'dd/MM/yyyy', { locale: es })}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          PAYMENT_COLORS[sale.payment_method] ?? 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}
                      </span>
                      {isCancelled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 font-medium">
                          Cancelada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {sale.items?.length ?? 0}{' '}
                      {(sale.items?.length ?? 0) === 1 ? 'producto' : 'productos'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-base font-bold ${
                        isCancelled ? 'line-through text-zinc-500' : 'text-zinc-100'
                      }`}
                    >
                      {formatCurrency(sale.total)}
                    </span>
                    {isExpanded
                      ? <ChevronUp size={15} className="text-zinc-500" />
                      : <ChevronDown size={15} className="text-zinc-500" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 px-3 pb-3">
                    {/* Items */}
                    <div className="pt-2 space-y-1 mb-3">
                      {(sale.items ?? []).map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-zinc-400">{item.product_name} × {item.quantity}</span>
                          <span className="text-zinc-100 font-medium">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Totals / notes */}
                    <div className="text-xs text-zinc-500 border-t border-zinc-800 pt-2 mb-3 space-y-0.5">
                      {(sale.amount_paid ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span>Cobrado</span>
                          <span>{formatCurrency(sale.amount_paid!)}</span>
                        </div>
                      )}
                      {sale.change_given > 0 && (
                        <div className="flex justify-between">
                          <span>Cambio</span>
                          <span>{formatCurrency(sale.change_given)}</span>
                        </div>
                      )}
                      {sale.notes && (
                        <div className="flex justify-between gap-4">
                          <span className="shrink-0">Nota</span>
                          <span className="truncate text-right">{sale.notes}</span>
                        </div>
                      )}
                      {isCancelled && sale.cancellation_reason && (
                        <div className="flex justify-between gap-4 text-red-400">
                          <span className="shrink-0">Cancelación</span>
                          <span className="truncate text-right">{sale.cancellation_reason}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {!isCancelled && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(sale)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
                        >
                          <Edit3 size={13} /> Editar
                        </button>
                        <button
                          onClick={() => { setCancelling(sale); setCancelReason(''); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-red-900 text-sm text-red-500 hover:bg-red-950/30 transition-colors"
                        >
                          <XCircle size={13} /> Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md p-5 space-y-4 border border-zinc-800">
            <h2 className="text-base font-bold text-zinc-100">Editar Venta</h2>
            <p className="text-xs text-zinc-500">
              {format(new Date(editing.created_at), 'dd/MM/yyyy HH:mm', { locale: es })} ·{' '}
              {formatCurrency(editing.total)}
            </p>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Método de pago</label>
              <select
                value={editForm.payment_method}
                onChange={(e) => setEditForm((f) => ({ ...f, payment_method: e.target.value }))}
                className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-zinc-100"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Monto cobrado</label>
              <input
                type="number"
                value={editForm.amount_paid}
                onChange={(e) => setEditForm((f) => ({ ...f, amount_paid: e.target.value }))}
                className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-zinc-100"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Notas</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-none bg-zinc-800 text-zinc-100"
                rows={2}
                placeholder="Opcional…"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(null)}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEdit}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-red-700 text-white text-sm font-semibold hover:bg-red-800 disabled:opacity-50"
              >
                {isSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Modal ────────────────────────────────────── */}
      {cancelling && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md p-5 space-y-4 border border-zinc-800">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-zinc-100">Cancelar Venta</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {format(new Date(cancelling.created_at), 'dd/MM/yyyy HH:mm', { locale: es })} ·{' '}
                  {formatCurrency(cancelling.total)}
                </p>
              </div>
            </div>

            {(cancelling.items?.length ?? 0) > 0 && (
              <div className="bg-amber-950/20 rounded-xl p-3 border border-amber-900/50">
                <p className="text-xs font-semibold text-amber-400 mb-2">Stock que se repondrá:</p>
                <div className="space-y-1">
                  {(cancelling.items ?? []).map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-amber-300">
                      <span>{item.product_name}</span>
                      <span>+{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-zinc-100"
                placeholder="Ej: Error de cobro, devolución…"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setCancelling(null)}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-red-700 text-white text-sm font-semibold hover:bg-red-800 disabled:opacity-50"
              >
                {isSaving ? 'Cancelando…' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
