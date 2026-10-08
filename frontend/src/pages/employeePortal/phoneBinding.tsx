import { useCallback, useEffect, useState } from 'react';
import { Loader2, Smartphone, ShieldCheck, ShieldAlert, Clock, Share, X } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { DeviceBindingMode, DeviceBindingStatus, DeviceProof, UserDeviceInfo } from '@/types/employeePortal';
import {
  LocalDevice, deviceKeySupported, deviceLabel, getLocalDevice, getOrCreateLocalDevice, isIOS, isStandalone, signNonce,
} from '@/lib/deviceKey';

/**
 * Attendance phone binding (one approved phone per login) — portal side.
 *
 * phoneState, as seen from THIS phone:
 *   OFF          binding not enforced for this employee
 *   UNSUPPORTED  browser can't hold a device key (not HTTPS / no WebCrypto)
 *   NONE         no phone on record yet → registering auto-approves
 *   ACTIVE       this phone is the approved one
 *   PENDING      this phone is waiting for HR approval
 *   OTHER        another phone is registered, or this one was revoked/rejected → request a change
 */
export type PhoneState = 'LOADING' | 'OFF' | 'UNSUPPORTED' | 'NONE' | 'ACTIVE' | 'PENDING' | 'OTHER';

export function errMsg(e: any, fallback = 'Something went wrong.'): string {
  return e?.response?.data?.message || e?.message || fallback;
}

export function useDeviceBinding(enabled: boolean) {
  const [status, setStatus] = useState<DeviceBindingStatus | null>(null);
  const [local, setLocal] = useState<LocalDevice | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const [s, l] = await Promise.all([
      employeePortalApi.myDevices().catch(() => null),
      getLocalDevice().catch(() => null),
    ]);
    setStatus(s);
    setLocal(l);
    setLoaded(true);
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  const mode: DeviceBindingMode = status?.mode ?? 'OFF';
  const devices = status?.devices ?? [];
  const thisDevice: UserDeviceInfo | null = local
    ? devices.find((d) => d.deviceUuid === local.deviceUuid && (d.status === 'ACTIVE' || d.status === 'PENDING'))
      ?? devices.find((d) => d.deviceUuid === local.deviceUuid) ?? null
    : null;
  const liveDevices = devices.filter((d) => d.status === 'ACTIVE' || d.status === 'PENDING');

  let phoneState: PhoneState;
  if (!enabled) phoneState = 'OFF';
  else if (!loaded) phoneState = 'LOADING';
  else if (mode === 'OFF') phoneState = 'OFF';
  else if (!deviceKeySupported()) phoneState = 'UNSUPPORTED';
  else if (thisDevice?.status === 'ACTIVE') phoneState = 'ACTIVE';
  else if (thisDevice?.status === 'PENDING') phoneState = 'PENDING';
  else if (devices.length === 0) phoneState = 'NONE';
  else phoneState = 'OTHER';

  /** Register this phone (first bind auto-approves; later ones wait for HR). */
  const bind = useCallback(async (reason?: string) => {
    const dev = await getOrCreateLocalDevice();
    const { nonce } = await employeePortalApi.deviceChallenge();
    const signature = await signNonce(nonce);
    const label = deviceLabel();
    const res = await employeePortalApi.bindDevice({
      deviceUuid: dev.deviceUuid, publicKey: dev.publicKey, nonce, signature,
      deviceLabel: label, platform: label.split(' · ')[0], reason,
    });
    await refresh();
    return res;
  }, [refresh]);

  /** Signed proof for a clock action; undefined when this phone has no key (server records it). */
  const proof = useCallback(async (): Promise<DeviceProof | undefined> => {
    try {
      const dev = await getLocalDevice();
      if (!dev) return undefined;
      const { nonce } = await employeePortalApi.deviceChallenge();
      return { deviceUuid: dev.deviceUuid, nonce, signature: await signNonce(nonce) };
    } catch {
      return undefined;
    }
  }, []);

  const withdraw = useCallback(async (id: number) => {
    await employeePortalApi.withdrawDevice(id);
    await refresh();
  }, [refresh]);

  return { mode, phoneState, devices, liveDevices, thisDevice, local, refresh, bind, proof, withdraw };
}

export type DeviceBinding = ReturnType<typeof useDeviceBinding>;

/** iPhone in a Safari tab: storage gets wiped → tell them to install the portal first. */
export function needsIosInstall(): boolean {
  return isIOS() && !isStandalone();
}

function IosInstallTip({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-[11px] ${className}`}>
      <Share className="mt-0.5 h-3 w-3 shrink-0" />
      <span>On iPhone, first tap <b>Share → Add to Home Screen</b>, then open the portal from that icon and register there. A Safari tab can forget this phone if the portal isn’t opened for a week.</span>
    </p>
  );
}

const REASONS = ['New phone', 'Lost / stolen phone', 'Phone broken / reset', 'Other'];

/**
 * Compact phone-status strip for the clock widget (sits on the green hero). Hidden when binding is
 * off. Offers Register (first phone) or Request change (another phone is registered).
 */
export function PhoneStatusStrip({ binding, onChanged }: { binding: DeviceBinding; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const { phoneState, mode, thisDevice } = binding;
  if (phoneState === 'OFF' || phoneState === 'LOADING') return null;

  const run = async (r?: string) => {
    setErr(''); setBusy(true);
    try { await binding.bind(r); setAsking(false); onChanged?.(); }
    catch (e) { setErr(errMsg(e, 'Could not register this phone.')); }
    finally { setBusy(false); }
  };

  const hard = mode === 'HARD';
  let tone = 'bg-white/10 text-emerald-50';
  let icon = <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-200" />;
  let text: React.ReactNode;
  let action: React.ReactNode = null;

  switch (phoneState) {
    case 'ACTIVE':
      text = <>Registered phone{thisDevice?.deviceLabel ? ` · ${thisDevice.deviceLabel}` : ''}</>;
      break;
    case 'PENDING':
      tone = 'bg-amber-400/20 text-amber-50';
      icon = <Clock className="h-4 w-4 shrink-0 text-amber-200" />;
      text = <>Phone waiting for HR approval{hard ? ' — attendance unlocks once approved.' : '.'}</>;
      break;
    case 'NONE':
      tone = 'bg-white/15 text-white';
      icon = <Smartphone className="h-4 w-4 shrink-0 text-emerald-100" />;
      text = <>Register this phone for attendance.</>;
      action = (
        <button onClick={() => run()} disabled={busy}
          className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Register'}
        </button>
      );
      break;
    case 'UNSUPPORTED':
      tone = 'bg-amber-400/20 text-amber-50';
      icon = <ShieldAlert className="h-4 w-4 shrink-0 text-amber-200" />;
      text = <>This browser can’t register a phone. Open the portal at its https:// address in Chrome or Safari.</>;
      break;
    default: // OTHER
      tone = 'bg-red-500/25 text-red-50';
      icon = <ShieldAlert className="h-4 w-4 shrink-0 text-red-200" />;
      text = <>Not your registered phone{hard ? ' — attendance is blocked here.' : ' — punches go to HR for approval.'}</>;
      action = !asking ? (
        <button onClick={() => setAsking(true)} className="shrink-0 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-bold text-red-700">
          Change phone
        </button>
      ) : null;
  }

  return (
    <div className={`mt-3 rounded-xl px-3 py-2 text-[12px] ${tone}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="flex-1">{text}</span>
        {action}
      </div>
      {phoneState === 'NONE' && needsIosInstall() && <IosInstallTip className="mt-1.5 text-emerald-50/90" />}
      {asking && (
        <div className="mt-2 flex items-center gap-2">
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border-0 bg-white/90 px-2 py-1.5 text-[12px] text-foreground">
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button onClick={() => run(reason)} disabled={busy}
            className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send to HR'}
          </button>
          <button onClick={() => setAsking(false)} className="shrink-0 p-1 text-white/80" aria-label="Cancel"><X className="h-4 w-4" /></button>
        </div>
      )}
      {err && <p className="mt-1.5 text-[11px] text-amber-100">{err}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  REVOKED: 'bg-muted text-muted-foreground',
  REPLACED: 'bg-muted text-muted-foreground',
  REJECTED: 'bg-red-50 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Approved', PENDING: 'Awaiting HR', REVOKED: 'Removed', REPLACED: 'Replaced', REJECTED: 'Rejected',
};

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Settings → "My registered phone": this phone's state, history, and register / change request. */
export function PhoneBindingSection() {
  const binding = useDeviceBinding(true);
  const { phoneState, mode, devices, thisDevice } = binding;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [reason, setReason] = useState(REASONS[0]);

  if (phoneState === 'LOADING') {
    return <div className="mx-3 flex justify-center rounded-xl border bg-card p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }
  if (phoneState === 'OFF') {
    return <p className="mx-3 rounded-xl border bg-card p-4 text-xs text-muted-foreground shadow-sm">Phone registration isn’t required for your attendance.</p>;
  }

  const bind = async (r?: string) => {
    setMsg(''); setErr(''); setBusy(true);
    try {
      const d = await binding.bind(r);
      setMsg(d.status === 'ACTIVE' ? 'This phone is now registered for attendance.' : 'Request sent. HR will approve your new phone.');
    } catch (e) { setErr(errMsg(e, 'Could not register this phone.')); }
    finally { setBusy(false); }
  };

  const withdraw = async (id: number) => {
    setMsg(''); setErr('');
    try { await binding.withdraw(id); } catch (e) { setErr(errMsg(e, 'Could not withdraw the request.')); }
  };

  return (
    <div className="mx-3 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-xs">
          <p className="font-medium">
            {phoneState === 'ACTIVE' ? 'This phone is your registered attendance phone.'
              : phoneState === 'PENDING' ? 'This phone is waiting for HR approval.'
              : phoneState === 'NONE' ? 'No phone registered yet.'
              : phoneState === 'UNSUPPORTED' ? 'This browser can’t register a phone.'
              : 'This is not your registered phone.'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {mode === 'HARD'
              ? 'Attendance can only be marked from your registered phone.'
              : 'Attendance from any other phone is sent to HR for approval.'}
          </p>
        </div>
      </div>

      {devices.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {d.deviceLabel || 'Phone'}{thisDevice?.id === d.id && <span className="ml-1 text-[11px] font-normal text-primary">(this phone)</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {d.status === 'ACTIVE' ? `Since ${fmtDate(d.approvedAt)} · last used ${fmtDate(d.lastSeenAt)}`
                    : d.status === 'PENDING' ? `Requested ${fmtDate(d.requestedAt)}${d.requestReason ? ` · ${d.requestReason}` : ''}`
                    : d.revokeReason || fmtDate(d.revokedAt)}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[d.status] ?? ''}`}>{STATUS_LABEL[d.status] ?? d.status}</span>
              {d.status === 'PENDING' && (
                <button onClick={() => withdraw(d.id)} className="shrink-0 text-[11px] text-muted-foreground underline">Withdraw</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {phoneState === 'UNSUPPORTED' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Open the portal at its https:// address (not an IP) in Chrome or Safari to register this phone.
        </p>
      )}
      {(phoneState === 'NONE' || phoneState === 'OTHER') && needsIosInstall() && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800"><IosInstallTip /></div>
      )}

      {phoneState === 'OTHER' && (
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Why are you changing phones?</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
      )}

      {err && <p className="text-xs text-destructive">{err}</p>}
      {msg && <p className="text-xs text-emerald-600">{msg}</p>}

      {(phoneState === 'NONE' || phoneState === 'OTHER') && (
        <button onClick={() => bind(phoneState === 'OTHER' ? reason : undefined)} disabled={busy}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
          {phoneState === 'NONE' ? 'Register this phone' : 'Request to use this phone'}
        </button>
      )}
    </div>
  );
}
