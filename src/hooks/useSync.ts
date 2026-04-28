import { useState, useEffect, useCallback, useRef } from 'react';
import { runSync } from '../lib/sync';
import { useOnlineStatus } from './useOnlineStatus';
import type { SyncStatus } from '../types';

const SYNC_INTERVAL_MS = 60_000; // cada 60s si está online

export function useSync() {
  const isOnline = useOnlineStatus();
  const [status, setStatus] = useState<SyncStatus>({
    lastSync: null,
    pending: 0,
    syncing: false,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sync = useCallback(async () => {
    if (!isOnline) return;
    setStatus((s) => ({ ...s, syncing: true, error: null }));
    const result = await runSync();
    setStatus({
      lastSync: new Date().toISOString(),
      pending: 0,
      syncing: false,
      error: result.ok ? null : (result.error ?? null),
    });
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) {
      sync();
      intervalRef.current = setInterval(sync, SYNC_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, sync]);

  return { status, syncNow: sync };
}
