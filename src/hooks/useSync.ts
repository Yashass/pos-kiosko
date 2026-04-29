import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { runSync } from '../lib/sync';
import { useOnlineStatus } from './useOnlineStatus';
import type { SyncStatus } from '../types';

const SYNC_INTERVAL_MS = 60_000;

export function useSync() {
  const isOnline = useOnlineStatus();
  const [status, setStatus] = useState<SyncStatus>({
    lastSync: null,
    pending: 0,
    syncing: false,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // manual=true → always show toast; manual=false → only show toast on error
  const sync = useCallback(async (manual = false) => {
    if (!isOnline) {
      if (manual) toast.error('Sin conexión a internet');
      return;
    }

    setStatus((s) => ({ ...s, syncing: true, error: null }));
    const result = await runSync();

    setStatus({
      lastSync: result.ok ? new Date().toISOString() : (status.lastSync ?? null),
      pending: 0,
      syncing: false,
      error: result.ok ? null : (result.error ?? null),
    });

    if (manual) {
      if (result.ok) {
        const msg =
          result.pushed === 0 && result.pulled === 0
            ? 'Todo sincronizado'
            : `Sync OK · ${result.pushed} enviados · ${result.pulled} recibidos`;
        toast.success(msg);
      } else {
        toast.error(`Error de sync: ${result.error}`, { duration: 6000 });
      }
    } else if (!result.ok && result.error !== 'Supabase no configurado — revisá el archivo .env') {
      // Auto-sync error (not missing config) → show once
      toast.error(`Sync: ${result.error}`, { duration: 5000 });
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOnline) {
      sync(false);
      intervalRef.current = setInterval(() => sync(false), SYNC_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, sync]);

  return { status, syncNow: () => sync(true) };
}
