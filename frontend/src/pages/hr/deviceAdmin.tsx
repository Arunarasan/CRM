import { useCallback, useEffect, useState } from 'react';
import { Smartphone, Check, X, Loader2, RotateCcw, Ban, History, ChevronDown, ChevronUp } from 'lucide-react';
import {
  attendanceApi, AdminDevice, DeviceBindingMode, DeviceEvent, DeviceRequest, EmployeeDevices,
} from '@/api/attendanceApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

/**
 * HR side of attendance phone binding: the approval queue (Workforce → Attendance) and the per-employee
 * phone card on the profile. One approved phone per login; see DeviceBindingService.
 */

const errText = (e: any, fallback = 'Action failed') => e?.response?.data?.message || e?.message || fallback;

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  REVOKED: 'bg-muted text-muted-foreground',
  REPLACED: 'bg-muted text-muted-foreground',
  REJECTED: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Approved', PENDING: 'Awaiting approval', REVOKED: 'Revoked', REPLACED: 'Replaced', REJECTED: 'Rejected',
};
const EVENT_LABEL: Record<string, string> = {
  BIND_REQUESTED: 'Requested a phone',
  AUTO_APPROVED: 'First phone registered',
  APPROVED: 'Phone approved',
  REJECTED: 'Phone rejected',
  REVOKED: 'Phone revoked',
  REPLACED: 'Phone replaced',
  RESET: 'Phones reset',
  MISMATCH_PUNCH: 'Punch from wrong phone',
  SHARED_DEVICE_DETECTED: 'Tried a shared phone',
};
const MODE_OPTIONS: { value: DeviceBindingMode | 'DEFAULT'; label: string }[] = [
  { value: 'DEFAULT', label: 'Company default' },
  { value: 'OFF', label: 'Off — any phone' },
  { value: 'SOFT', label: 'Flag — other phones go to HR' },
  { value: 'HARD', label: 'Strict — registered phone only' },
];

function when(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function DeviceStatusPill({ status }: { status: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] ?? 'bg-muted'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/* ------------------------------- Approval queue ------------------------------- */

/** Phone registration / change requests waiting for HR. Hidden when there's nothing to review. */
export function DeviceRequests() {
  const [rows, setRows] = useState<DeviceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    attendanceApi.listDeviceRequests().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  const resolve = async (row: DeviceRequest, approve: boolean) => {
    let reason: string | undefined;
    if (!approve) {
      const r = window.prompt('Reason for rejecting (shown to the employee):');
      if (r === null) return;
      reason = r || undefined;
    }
    setBusy(row.id);
    try {
      approve ? await attendanceApi.approveDevice(row.id) : await attendanceApi.rejectDevice(row.id, reason);
      toast.success(approve ? `${row.userName}'s new phone approved` : 'Request rejected');
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!loading && rows.length === 0) return null;

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5 sm:py-4">
        <Smartphone className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Phone change requests</h2>
        {rows.length > 0 && (
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{rows.length}</span>
        )}
      </header>
      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => {
            const current = r.currentDevices?.[0];
            return (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{r.userName}</span>
                    {r.requestReason && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{r.requestReason}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">
                    New: <b>{r.deviceLabel ?? 'Phone'}</b>
                    {current
                      ? <span className="text-muted-foreground"> · replaces {current.deviceLabel ?? 'current phone'} (last used {when(current.lastSeenAt)})</span>
                      : <span className="text-muted-foreground"> · no phone registered now</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Requested {when(r.requestedAt)}{r.lastIp ? ` · IP ${r.lastIp}` : ''}
                  </p>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                  <Button variant="forest" size="sm" disabled={busy === r.id} onClick={() => resolve(r, true)}>
                    {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => resolve(r, false)}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ----------------------------- Employee profile card ----------------------------- */

/** Profile card: the employee's phone(s), enforcement mode, revoke/reset and the audit trail. */
export function AttendancePhoneCard({ employeeId, canEdit }: { employeeId: number; canEdit: boolean }) {
  const [data, setData] = useState<EmployeeDevices | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(() => {
    attendanceApi.employeeDevices(employeeId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [employeeId]);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); load(); }
    catch (e) { toast.error(errText(e)); }
    finally { setBusy(null); }
  };

  const setMode = (mode: DeviceBindingMode | 'DEFAULT') =>
    run('mode', () => attendanceApi.setDeviceMode(employeeId, mode), 'Phone rule updated');

  const revoke = (d: AdminDevice) => {
    const reason = window.prompt(`Revoke "${d.deviceLabel ?? 'this phone'}"? Reason (optional):`);
    if (reason === null) return;
    run(`d${d.id}`, () => attendanceApi.revokeDevice(d.id, reason || undefined), 'Phone revoked');
  };
  const reject = (d: AdminDevice) => {
    const reason = window.prompt('Reason for rejecting (shown to the employee):');
    if (reason === null) return;
    run(`d${d.id}`, () => attendanceApi.rejectDevice(d.id, reason || undefined), 'Request rejected');
  };
  const reset = () => {
    if (!data?.userId) return;
    if (!window.confirm('Clear all registered phones? Their next clock-in registers the phone they use (auto-approved). Use this for a lost or replaced phone.')) return;
    run('reset', () => attendanceApi.resetDevices(data.userId!), 'Phones reset');
  };

  const devices = data?.devices ?? [];
  const events: DeviceEvent[] = data?.events ?? [];
  const live = devices.filter((d) => d.status === 'ACTIVE' || d.status === 'PENDING');
  const past = devices.filter((d) => d.status !== 'ACTIVE' && d.status !== 'PENDING');

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Attendance phone</CardTitle>
        {data && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Rule
            <select
              value={data.modeOverride ?? 'DEFAULT'}
              disabled={!canEdit || busy === 'mode'}
              onChange={(e) => setMode(e.target.value as DeviceBindingMode | 'DEFAULT')}
              className="h-8 rounded-md border bg-background px-2 text-sm text-foreground disabled:opacity-60"
            >
              {MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === 'DEFAULT' && !data.modeOverride ? `${o.label} (${data.effectiveMode.toLowerCase()})` : o.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Couldn’t load phone details.</p>
        ) : (
          <>
            {data.effectiveMode === 'OFF' && (
              <p className="text-xs text-muted-foreground">Phone check is off — attendance from any phone is accepted.</p>
            )}
            {data.userId == null ? (
              <p className="text-sm text-muted-foreground">No portal login yet. Their phone registers on their first clock-in.</p>
            ) : live.length === 0 ? (
              <p className="text-sm text-muted-foreground">No phone registered. The phone they clock in from next is registered automatically.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {live.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{d.deviceLabel ?? 'Phone'}</span>
                        <DeviceStatusPill status={d.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {d.status === 'ACTIVE'
                          ? `Approved ${when(d.approvedAt)}${d.approvedBy ? ` by ${d.approvedBy === 'AUTO' ? 'auto (first phone)' : d.approvedBy}` : ''} · last used ${when(d.lastSeenAt)}`
                          : `Requested ${when(d.requestedAt)}${d.requestReason ? ` · ${d.requestReason}` : ''}`}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-2">
                        {d.status === 'PENDING' ? (
                          <>
                            <Button size="sm" variant="forest" disabled={!!busy} onClick={() => run(`d${d.id}`, () => attendanceApi.approveDevice(d.id), 'Phone approved')}>
                              {busy === `d${d.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                            </Button>
                            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => reject(d)}><X className="h-4 w-4" /> Reject</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => revoke(d)}>
                            {busy === `d${d.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Revoke
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {past.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Previous: {past.slice(0, 3).map((d) => `${d.deviceLabel ?? 'Phone'} (${(STATUS_LABEL[d.status] ?? d.status).toLowerCase()})`).join(', ')}
                {past.length > 3 ? ` +${past.length - 3} more` : ''}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {events.length > 0 ? (
                <button onClick={() => setShowLog((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <History className="h-3.5 w-3.5" /> Activity ({events.length})
                  {showLog ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              ) : <span />}
              {canEdit && data.userId != null && devices.length > 0 && (
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={reset}>
                  {busy === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reset phone (lost / changed)
                </Button>
              )}
            </div>

            {showLog && (
              <ol className="space-y-2 border-l pl-3">
                {events.map((ev) => (
                  <li key={ev.id} className="text-xs">
                    <p className={`font-medium ${ev.event === 'MISMATCH_PUNCH' || ev.event === 'SHARED_DEVICE_DETECTED' ? 'text-amber-700' : ''}`}>
                      {EVENT_LABEL[ev.event] ?? ev.event}
                      <span className="ml-1.5 font-normal text-muted-foreground">{when(ev.at)}</span>
                    </p>
                    {ev.details && <p className="text-muted-foreground">{ev.details}</p>}
                    {ev.actor && ev.event !== 'MISMATCH_PUNCH' && <p className="text-muted-foreground/80">by {ev.actor}</p>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
