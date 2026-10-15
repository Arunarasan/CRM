import { OUTBOX_STORE, QUEUE_STORE, withStore } from './db';
import { currentOwner, newClientId } from './owner';

export interface OutboxItem {
  /** Also sent as the Idempotency-Key, so the server never creates the same record twice. */
  clientId: string;
  owner: string;
  method: 'post' | 'put' | 'patch' | 'delete';
  url: string;
  payload?: unknown;
  description: string;
  queuedAt: string;
  status: 'pending' | 'failed';
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

export const OUTBOX_EVENT = 'crm-outbox-changed';
export const notifyOutboxChanged = () => window.dispatchEvent(new Event(OUTBOX_EVENT));

export async function addToOutbox(
  a: { method: OutboxItem['method']; url: string; payload?: unknown; description: string },
  clientId: string = newClientId(),
): Promise<OutboxItem> {
  const item: OutboxItem = {
    clientId,
    owner: currentOwner() ?? '',
    method: a.method,
    url: a.url,
    payload: a.payload,
    description: a.description,
    queuedAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
  };
  await withStore(OUTBOX_STORE, 'readwrite', (s) => s.put(item));
  notifyOutboxChanged();
  return item;
}

export async function putOutboxItem(item: OutboxItem): Promise<void> {
  await withStore(OUTBOX_STORE, 'readwrite', (s) => s.put(item));
  notifyOutboxChanged();
}

export async function removeOutboxItem(clientId: string): Promise<void> {
  await withStore(OUTBOX_STORE, 'readwrite', (s) => s.delete(clientId));
  notifyOutboxChanged();
}

/** Only the current user's items, oldest first (order matters: a lead must exist before its report). */
export async function listOutbox(): Promise<OutboxItem[]> {
  const all = await withStore<OutboxItem[]>(OUTBOX_STORE, 'readonly', (s) => s.getAll());
  const owner = currentOwner();
  return all.filter((i) => i.owner === owner).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

/** One-time: move actions queued by the old (pre-idempotency) offline queue into the outbox. */
export async function migrateLegacyQueue(): Promise<void> {
  try {
    const legacy = await withStore<any[]>(QUEUE_STORE, 'readonly', (s) => s.getAll());
    if (!legacy.length) return;
    for (const l of legacy) {
      await addToOutbox({ method: l.method, url: l.url, payload: l.payload, description: l.description ?? 'Queued action' });
      await withStore(QUEUE_STORE, 'readwrite', (s) => s.delete(l.id));
    }
  } catch {
    /* nothing to migrate */
  }
}
