import axios from 'axios';
import type { FingerCapture } from '@/api/attendanceApi';

/**
 * The kiosk phone's API client. Deliberately separate from the shared `api` instance: a kiosk has
 * no user login, so it must not send the staff JWT or trigger the token-refresh / sign-in redirect.
 * It authenticates with the token it received when paired.
 */
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'kioskToken';

export const kioskToken = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage blocked */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

export interface KioskInfo {
  id: number;
  name: string;
  officeLocationId: number | null;
  officeLocationName: string | null;
  /** What this kiosk accepts: FACE | FINGER | EITHER. */
  verifyMode: 'FACE' | 'FINGER' | 'EITHER';
  serverTime: string;
}

export interface KioskPairResult extends KioskInfo {
  token: string;
}

export type KioskOutcome =
  | 'CHECKED_IN' | 'CHECKED_OUT' | 'ALREADY_IN' | 'NOT_IN' | 'TOO_SOON' | 'NOT_RECOGNISED' | 'AMBIGUOUS';

export interface KioskPunchResult {
  outcome: KioskOutcome;
  employeeId?: number;
  name?: string;
  employeeCode?: string | null;
  time?: string | null;
  minutesWorked?: number | null;
  selfieUrl?: string | null;
  needsApproval: boolean;
}

const unwrap = <T,>(body: any): T => (body && typeof body === 'object' && 'success' in body ? body.data : body) as T;

export const kioskApi = {
  pair: (code: string) =>
    http.post('/public/kiosk/pair', { code, deviceInfo: navigator.userAgent?.slice(0, 250) }).then((r) => unwrap<KioskPairResult>(r.data)),
  me: () =>
    http.get('/public/kiosk/me', { headers: { 'X-Kiosk-Token': kioskToken.get() ?? '' } }).then((r) => unwrap<KioskInfo>(r.data)),
  punch: (action: 'IN' | 'OUT', descriptor: number[], selfie: Blob | null, liveness: string | null) => {
    const form = new FormData();
    form.append('action', action);
    form.append('descriptor', JSON.stringify(descriptor));
    if (liveness) form.append('liveness', liveness);
    if (selfie) form.append('selfie', selfie, 'selfie.jpg');
    return http
      .post('/public/kiosk/punch', form, { headers: { 'X-Kiosk-Token': kioskToken.get() ?? '', 'Content-Type': 'multipart/form-data' } })
      .then((r) => unwrap<KioskPunchResult>(r.data));
  },
  punchFinger: (action: 'IN' | 'OUT', capture: FingerCapture, selfie: Blob | null) => {
    const form = new FormData();
    form.append('action', action);
    form.append('capture', JSON.stringify(capture));
    if (selfie) form.append('selfie', selfie, 'selfie.jpg');
    return http
      .post('/public/kiosk/punch-finger', form, { headers: { 'X-Kiosk-Token': kioskToken.get() ?? '', 'Content-Type': 'multipart/form-data' } })
      .then((r) => unwrap<KioskPunchResult>(r.data));
  },
};
