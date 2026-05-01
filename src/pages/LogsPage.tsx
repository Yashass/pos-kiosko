import { useEffect, useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useSaleStore } from '../stores/saleStore';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SaleLog } from '../types';

function ActionBadge({ action }: { action: SaleLog['action'] }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        action === 'cancel'
          ? 'bg-red-900/60 text-red-300 border border-red-800'
          : 'bg-amber-900/60 text-amber-300 border border-amber-800'
      }`}
    >
      {action === 'cancel' ? 'Cancelación' : 'Edición'}
    </span>
  );
}

interface Change { field: string; old: string; new: string }

function ChangesTable({ changes }: { changes: string }) {
  let parsed: Change[] = [];
  try { parsed = JSON.parse(changes); } catch { /* no-op */ }
  if (!parsed.length) return <span className="text-zinc-600 text-xs italic">Sin cambios registrados</span>;
  return (
    <table className="text-xs w-full mt-1">
      <thead>
        <tr className="text-zinc-500">
          <th className="text-left pr-4 font-medium pb-1">Campo</th>
          <th className="text-left pr-4 font-medium pb-1">Anterior</th>
          <th className="text-left font-medium pb-1">Nuevo</th>
        </tr>
      </thead>
      <tbody>
        {parsed.map((c, i) => (
          <tr key={i} className="text-zinc-300">
            <td className="pr-4 py-0.5 text-zinc-400">{c.field}</td>
            <td className="pr-4 py-0.5 line-through text-red-400">{c.old || '—'}</td>
            <td className="py-0.5 text-emerald-400">{c.new || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LogsPage() {
  const { saleLogs, logsLoading, loadLogs } = useSaleStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<'all' | 'edit' | 'cancel'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => { loadLogs(); }, []);

  const filtered = saleLogs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!log.note.toLowerCase().includes(q) && !log.sale_id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <FileText size={22} className="text-red-500" />
        <h1 className="text-xl font-bold text-zinc-100">Registro de Auditoría</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {(['all', 'edit', 'cancel'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                actionFilter === a
                  ? 'bg-red-700 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {a === 'all' ? 'Todos' : a === 'edit' ? 'Ediciones' : 'Cancelaciones'}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nota o ID…"
            className="w-full pl-8 pr-8 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {logsLoading ? (
        <div className="text-center py-12 text-zinc-500">Cargando registros…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-600">No hay registros de auditoría</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const isOpen = expanded === log.id;
            return (
              <div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <ActionBadge action={log.action} />
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500 font-mono truncate">
                        Venta <span className="text-zinc-400">{log.sale_id.slice(0, 8)}…</span>
                      </p>
                      <p className="text-sm text-zinc-200 truncate mt-0.5">{log.note}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-500 whitespace-nowrap">
                      {format(parseISO(log.created_at), "d MMM yyyy HH:mm", { locale: es })}
                    </span>
                    {isOpen ? (
                      <ChevronUp size={15} className="text-zinc-500" />
                    ) : (
                      <ChevronDown size={15} className="text-zinc-500" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-2">
                      ID completo: <span className="font-mono text-zinc-400">{log.sale_id}</span>
                    </p>
                    <ChangesTable changes={log.changes} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
