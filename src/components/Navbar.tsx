import { RefreshCw, Wifi, WifiOff, ShoppingCart, LogOut } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSync } from '../hooks/useSync';
import { useSaleStore } from '../stores/saleStore';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Navbar() {
  const isOnline = useOnlineStatus();
  const { status, syncNow } = useSync();
  const cartCount = useSaleStore((s) => s.cart.reduce((acc, i) => acc + i.quantity, 0));
  const { user, skipAuth, signOut } = useAuthStore();

  return (
    <header className="bg-zinc-950 text-zinc-100 px-4 py-3 flex items-center justify-between shadow-lg border-b border-zinc-800">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-red-700 rounded-lg flex items-center justify-center font-bold text-sm text-white">
          POS
        </div>
        <div>
          <h1 className="font-bold text-sm leading-tight text-zinc-100">POS Kyoskuhin</h1>
          <p className="text-xs text-zinc-500">
            {format(new Date(), "EEEE d MMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Cart badge */}
        {cartCount > 0 && (
          <div className="flex items-center gap-1 bg-red-700 px-2 py-1 rounded-full text-xs font-semibold text-white">
            <ShoppingCart size={12} />
            <span>{cartCount}</span>
          </div>
        )}

        {/* Sync status */}
        <button
          onClick={syncNow}
          disabled={!isOnline || status.syncing}
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-zinc-800 disabled:opacity-50 ${status.error ? 'text-red-400' : ''}`}
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
                ? 'animate-spin text-red-400'
                : status.error
                ? 'text-red-400'
                : 'text-zinc-500'
            }
          />
          <span className={`hidden sm:inline ${status.error ? 'text-red-400' : 'text-zinc-400'}`}>
            {status.syncing ? 'Sincronizando…' : status.error ? 'Error sync' : 'Sync'}
          </span>
        </button>

        {/* Online indicator */}
        <div
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            isOnline ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
          }`}
        >
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* User / sign-out */}
        {!skipAuth && user && (
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            title={`Cerrar sesión (${user.email})`}
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        )}
      </div>
    </header>
  );
}
