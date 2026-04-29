import { RefreshCw, Wifi, WifiOff, ShoppingCart } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSync } from '../hooks/useSync';
import { useSaleStore } from '../stores/saleStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Navbar() {
  const isOnline = useOnlineStatus();
  const { status, syncNow } = useSync();
  const cartCount = useSaleStore((s) => s.cart.reduce((acc, i) => acc + i.quantity, 0));

  return (
    <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">
          POS
        </div>
        <div>
          <h1 className="font-bold text-sm leading-tight">POS Kiosco</h1>
          <p className="text-xs text-slate-400">
            {format(new Date(), "EEEE d MMM", { locale: es })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Cart badge */}
        {cartCount > 0 && (
          <div className="flex items-center gap-1 bg-blue-600 px-2 py-1 rounded-full text-xs font-semibold">
            <ShoppingCart size={12} />
            <span>{cartCount}</span>
          </div>
        )}

        {/* Sync status */}
        <button
          onClick={syncNow}
          disabled={!isOnline || status.syncing}
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-slate-700 disabled:opacity-50 ${status.error ? 'text-red-400' : ''}`}
          title={
            status.error
              ? `Error: ${status.error}`
              : status.lastSync
              ? `Última sync: ${new Date(status.lastSync).toLocaleTimeString()}`
              : 'Sin sincronizar — hacé clic para sincronizar'
          }
        >
          <RefreshCw
            size={13}
            className={
              status.syncing
                ? 'animate-spin text-blue-400'
                : status.error
                ? 'text-red-400'
                : 'text-slate-400'
            }
          />
          <span className={`hidden sm:inline ${status.error ? 'text-red-400' : 'text-slate-300'}`}>
            {status.syncing ? 'Sincronizando…' : status.error ? 'Error sync' : 'Sync'}
          </span>
        </button>

        {/* Online indicator */}
        <div
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            isOnline ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          }`}
        >
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}
