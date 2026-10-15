import axios from 'axios';
import api from '@/lib/api';
import { listOutbox, putOutboxItem, removeOutboxItem, migrateLegacyQueue, notifyOutboxChanged, type OutboxItem } from './outbox';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const FLUSH_INTERVAL_MS = 30_000;
const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000, 900_000];

let flushing = false;
let started = false;

/** True when the request never got an answer from the server (offline, DNS, timeout). */
export function isNetworkError(e: unknown): boolean {
  return axios.isAxiosError(e) && !e.response;
}

function describeError(e: any): string {
  return e?.response?.data?.message || e?.message || 'Request was rejected';
}

async function sendOne(item: OutboxItem) {
  await api.request({
    method: item.method,
    url: item.url,
    data: item.payload,
    headers: { [IDEMPOTENCY_HEADER]: item.clientId, 'X-Client-Queued-At': item.queuedAt },
  });
}

async function flushInner(force: boolean): Promise<void> {
  if (!navigator.onLine) return;
  const items = await listOutbox();
  const now = Date.now();
  for (const item of items) {
    if (item.status === 'failed') continue;
    if (!force && item.nextAttemptAt > now) break; // keep order: don't skip past an item that is backing off
    try {
      await sendOne(item);
      await removeOutboxItem(item.clientId);
    } catch (e: any) {
      const status: number | undefined = e?.response?.status;
      if (isNetworkError(e) || status === 401) return; // still offline, or logged out - try again later
      const inProgress = status === 409 && e.response?.headers?.['x-idempotency-in-progress'];
      if (inProgress || (status !== undefined && (status >= 500 || status === 408 || status === 429))) {
        const attempts = item.attempts + 1;
        await putOutboxItem({ ...item, attempts, nextAttemptAt: Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)], lastError: describeError(e) });
        return; // preserve order, retry the whole queue later
      }
      // The server understood and refused it (validation, permission...): retrying cannot help.
      await putOutboxItem({ ...item, status: 'failed', attempts: item.attempts + 1, lastError: describeError(e) });
    }
  }
}

/** Sends everything waiting, oldest first. Safe to call often; one flush runs at a time (also across tabs). */
export async function flushOutbox(force = false): Promise<void> {
  if (flushing) return;
  flushing = true;
  notifyOutboxChanged();
  try {
    const locks = (navigator as any).locks;
    if (locks?.request) {
      await locks.request('crm-outbox-flush', { ifAvailable: true }, async (lock: unknown) => {
        if (lock) await flushInner(force);
      });
    } else {
      await flushInner(force);
    }
  } finally {
    flushing = false;
    notifyOutboxChanged();
  }
}

export const isFlushing = () => flushing;

/** Re-queue a failed item for another try (after the user fixed the cause, or just wants to retry). */
export async function retryItem(item: OutboxItem): Promise<void> {
  await putOutboxItem({ ...item, status: 'pending', nextAttemptAt: 0, lastError: undefined });
  void flushOutbox(true);
}

/** Wires the automatic triggers. Call once at startup. */
export function startOutboxSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void migrateLegacyQueue().then(() => flushOutbox());
  window.addEventListener('online', () => void flushOutbox(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushOutbox();
  });
  window.setInterval(() => void flushOutbox(), FLUSH_INTERVAL_MS);
}
