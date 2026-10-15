import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { CACHE_STORE, withStore } from '@/offline/db';
import { addToOutbox, listOutbox, OUTBOX_EVENT, type OutboxItem } from '@/offline/outbox';
import { newClientId } from '@/offline/owner';
import { flushOutbox, isFlushing, isNetworkError, IDEMPOTENCY_HEADER } from '@/offline/sync';

// Offline support for the employee portal. A write that cannot reach the server is saved in the
// phone's outbox (IndexedDB) and sent automatically when the connection returns - see offline/sync.ts.
// Every write carries an Idempotency-Key so a retry can never create the same record twice.

export type { OutboxItem as QueuedAction };

export async function cacheRead<T>(key: string): Promise<T | undefined> {
  const record = await withStore<{ key: string; value: T } | undefined>(CACHE_STORE, 'readonly', (s) => s.get(key));
  return record?.value;
}

export async function cacheWrite<T>(key: string, value: T): Promise<void> {
  await withStore(CACHE_STORE, 'readwrite', (s) => s.put({ key, value }));
}

export interface WriteAction {
  method: 'post' | 'put' | 'patch' | 'delete';
  url: string;
  payload?: unknown;
  description: string;
}

export async function flushQueue(): Promise<{ succeeded: number; remaining: number }> {
  const before = (await listOutbox()).length;
  await flushOutbox(true);
  const remaining = (await listOutbox()).filter((i) => i.status === 'pending').length;
  return { succeeded: Math.max(0, before - (await listOutbox()).length), remaining };
}

/**
 * Runs a write now; if there is no connection (or the server hiccups) it is queued and sent later instead.
 * A request the server answers with a 4xx is a real error and is thrown, not queued.
 */
export async function runOrQueue<T = unknown>(action: WriteAction): Promise<{ queued: boolean; data?: T }> {
  const clientId = newClientId();
  if (!navigator.onLine) {
    await addToOutbox(action, clientId);
    return { queued: true };
  }
  try {
    const res = await api.request<T>({
      method: action.method,
      url: action.url,
      data: action.payload,
      headers: { [IDEMPOTENCY_HEADER]: clientId },
    });
    return { queued: false, data: res.data };
  } catch (e: any) {
    const status: number | undefined = e?.response?.status;
    // Same clientId on purpose: if the first attempt did reach the server, the retry is recognised.
    if (isNetworkError(e) || (status !== undefined && status >= 500)) {
      await addToOutbox(action, clientId);
      return { queued: true };
    }
    throw e;
  }
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refreshQueueSize = useCallback(() => {
    listOutbox().then(setItems).catch(() => {});
    setSyncing(isFlushing());
  }, []);

  useEffect(() => {
    refreshQueueSize();
    const up = () => { setIsOnline(true); refreshQueueSize(); };
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    window.addEventListener(OUTBOX_EVENT, refreshQueueSize);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      window.removeEventListener(OUTBOX_EVENT, refreshQueueSize);
    };
  }, [refreshQueueSize]);

  const failedCount = items.filter((i) => i.status === 'failed').length;
  return { isOnline, items, queueSize: items.length, failedCount, syncing, refreshQueueSize, runOrQueue, flushQueue };
}
