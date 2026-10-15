import type { AxiosRequestConfig } from 'axios';
import { CACHE_STORE, withStore } from './db';
import { currentOwner } from './owner';

// The portal keeps the last good answer of its read screens so they still open with no signal.
// Money/identity screens are deliberately never stored on the phone.
const CACHEABLE = /^\/(employee-portal|employee-tasks)(\/|$)/;
const NEVER = /(payslip|salary|earning|loan|advance|bonus|reward|document|profile|password|webauthn|device|timesheet|payroll|biometric)/i;

export const OFFLINE_CACHE_EVENT = 'crm-offline-cache-hit';

export function isCacheable(config: AxiosRequestConfig): boolean {
  if ((config.method ?? 'get').toLowerCase() !== 'get') return false;
  const url = config.url ?? '';
  return CACHEABLE.test(url) && !NEVER.test(url);
}

function keyFor(config: AxiosRequestConfig): string | null {
  const owner = currentOwner();
  if (!owner) return null;
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${owner}|${config.url}|${params}`;
}

export function storeResponse(config: AxiosRequestConfig, data: unknown): void {
  const key = keyFor(config);
  if (!key) return;
  withStore(CACHE_STORE, 'readwrite', (s) => s.put({ key, value: data, savedAt: Date.now() })).catch(() => {});
}

export async function lookupResponse(config: AxiosRequestConfig): Promise<{ data: unknown; savedAt: number } | null> {
  const key = keyFor(config);
  if (!key) return null;
  try {
    const rec = await withStore<{ value: unknown; savedAt: number } | undefined>(CACHE_STORE, 'readonly', (s) => s.get(key));
    return rec ? { data: rec.value, savedAt: rec.savedAt } : null;
  } catch {
    return null;
  }
}
