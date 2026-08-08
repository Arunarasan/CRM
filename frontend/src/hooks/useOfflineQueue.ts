import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

// Lightweight offline support for the mobile Employee Task module: NOT a full installable PWA
// (no service worker / manifest / background sync — see plan's "Future improvements"). This just
// queues mutating calls in IndexedDB when the network is unavailable and replays them once it's
// back, plus caches GET responses so a task screen can still render read-only while offline.

const DB_NAME = 'employee_task_offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'queue';
const CACHE_STORE = 'cache';

export interface QueuedAction {
  id?: number;
  method: 'post' | 'put' | 'delete';
  url: string;
  payload?: unknown;
  description: string;
  queuedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = fn(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheRead<T>(key: string): Promise<T | undefined> {
  const record = await withStore<{ key: string; value: T } | undefined>(CACHE_STORE, 'readonly', (s) => s.get(key));
  return record?.value;
}

export async function cacheWrite<T>(key: string, value: T): Promise<void> {
  await withStore(CACHE_STORE, 'readwrite', (s) => s.put({ key, value }));
}

export async function enqueueAction(action: Omit<QueuedAction, 'id' | 'queuedAt'>): Promise<void> {
  await withStore(QUEUE_STORE, 'readwrite', (s) => s.add({ ...action, queuedAt: new Date().toISOString() }));
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  return withStore<QueuedAction[]>(QUEUE_STORE, 'readonly', (s) => s.getAll());
}

async function removeQueuedAction(id: number): Promise<void> {
  await withStore(QUEUE_STORE, 'readwrite', (s) => s.delete(id));
}

export async function flushQueue(): Promise<{ succeeded: number; remaining: number }> {
  const actions = await getQueuedActions();
  let succeeded = 0;
  for (const action of actions) {
    try {
      await api.request({ method: action.method, url: action.url, data: action.payload });
      if (action.id !== undefined) await removeQueuedAction(action.id);
      succeeded++;
    } catch {
      // Stop at the first failure (likely still offline or a real error) — leave the rest queued.
      break;
    }
  }
  const remaining = (await getQueuedActions()).length;
  return { succeeded, remaining };
}

/** Runs a mutation immediately; if it fails (offline or network error), queues it for later instead of throwing. */
export async function runOrQueue(action: Omit<QueuedAction, 'id' | 'queuedAt'>): Promise<{ queued: boolean }> {
  if (!navigator.onLine) {
    await enqueueAction(action);
    return { queued: true };
  }
  try {
    await api.request({ method: action.method, url: action.url, data: action.payload });
    return { queued: false };
  } catch {
    await enqueueAction(action);
    return { queued: true };
  }
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  const refreshQueueSize = useCallback(() => {
    getQueuedActions().then((actions) => setQueueSize(actions.length)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshQueueSize();
    const handleOnline = async () => {
      setIsOnline(true);
      await flushQueue();
      refreshQueueSize();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshQueueSize]);

  return { isOnline, queueSize, refreshQueueSize, runOrQueue, flushQueue };
}
