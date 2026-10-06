import { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint, Loader2, ShieldCheck, Trash2, X, Router, Info, CheckCircle2, XCircle } from 'lucide-react';
import {
  attendanceDeviceApi, fingerLabel, FINGERS, timeAgo, type BiometricStatus, type EnrollmentSession,
  type Branch, type Shift,
} from '@/api/attendanceDeviceApi';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Panel } from '@/pages/workforce/hrUi';

/**
 * Employee → Biometric. Enrollment is started here and completed at the chosen attendance device:
 * the device picks the request up on its next heartbeat and guides the employee through the scans.
 * The CRM never receives the fingerprint — only a reference to the template stored on the device.
 */
const SELECT = 'h-10 w-full rounded-md border border-input bg-card px-2 text-sm';
const errMsg = (e: any, f: string) => e?.response?.data?.message || e?.message || f;
const OPEN = ['PENDING', 'IN_PROGRESS'];
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function EmployeeBiometricTab({ employeeId }: { employeeId: number }) {
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [finger, setFinger] = useState('RIGHT_INDEX');
  const [session, setSession] = useState<EnrollmentSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    attendanceDeviceApi.biometricStatus(employeeId).then((s) => {
      setStatus(s);
      setDeviceId((d) => d || (s.devices[0] ? String(s.devices[0].id) : ''));
      const open = s.sessions.find((x) => OPEN.includes(x.status));
      setSession((cur) => (cur && !OPEN.includes(cur.status) ? cur : open ?? cur));
    }).catch((e) => toast.error(errMsg(e, 'Could not load biometric status')));
  }, [employeeId]);

  useEffect(() => {
    load();
    attendanceDeviceApi.branches().then(setBranches).catch(() => setBranches([]));
    attendanceDeviceApi.shifts().then(setShifts).catch(() => setShifts([]));
  }, [load]);

  // Poll an open enrollment until the device finishes it.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!session || !OPEN.includes(session.status)) return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await attendanceDeviceApi.enrollmentSession(session.id);
        setSession(s);
        if (!OPEN.includes(s.status)) {
          if (s.status === 'COMPLETED') toast.success('Fingerprint enrolled');
          load();
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session, load]);

  const start = async () => {
    if (!deviceId) return toast.error('Select an attendance device.');
    setBusy(true);
    try { setSession(await attendanceDeviceApi.startEnrollment(employeeId, Number(deviceId), finger)); }
    catch (e) { toast.error(errMsg(e, 'Could not start enrollment')); } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!session) return;
    try { setSession(await attendanceDeviceApi.cancelEnrollment(session.id)); load(); } catch (e) { toast.error(errMsg(e, 'Cancel failed')); }
  };
  const removeOne = async (id: number) => {
    if (!window.confirm('Remove this fingerprint? The device deletes it on its next sync.')) return;
    try { await attendanceDeviceApi.removeEnrollment(id); toast.success('Fingerprint removed'); load(); } catch (e) { toast.error(errMsg(e, 'Remove failed')); }
  };
  const removeAll = async () => {
    const reason = window.prompt('Remove ALL fingerprints of this employee? They will not be able to mark attendance until re-enrolled.\nReason:');
    if (reason === null) return;
    try { const r = await attendanceDeviceApi.removeAllBiometrics(employeeId, reason || undefined); toast.success(`Removed ${r.revoked}`); load(); }
    catch (e) { toast.error(errMsg(e, 'Remove failed')); }
  };
  const assign = async (patch: { shiftId?: string; branchId?: string }) => {
    try {
      await attendanceDeviceApi.assign({
        employeeIds: [employeeId],
        shiftId: patch.shiftId && patch.shiftId !== 'DEFAULT' ? Number(patch.shiftId) : undefined,
        useDefaultShift: patch.shiftId === 'DEFAULT',
        branchId: patch.branchId ? Number(patch.branchId) : undefined,
      });
      toast.success('Saved');
      load();
    } catch (e) { toast.error(errMsg(e, 'Save failed')); }
  };

  if (!status) return <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const active = status.enrollments.filter((e) => e.status === 'ACTIVE');
  const history = status.enrollments.filter((e) => e.status !== 'ACTIVE');
  const open = session && OPEN.includes(session.status);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Panel>
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Fingerprint className="h-4 w-4 text-primary" /> Fingerprint enrollment
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.enrolled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
              {status.enrolled ? `Enrolled · ${active.length} finger${active.length === 1 ? '' : 's'}` : 'Not enrolled'}
            </span>
          </header>

          {open ? (
            <div className="space-y-3 p-5">
              <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">
                    {session!.status === 'PENDING' ? `Waiting for ${session!.deviceName}…` : `Scanning on ${session!.deviceName}`}
                  </div>
                  <p className="mt-1 text-slate-600">
                    Ask {status.employeeName} to go to the attendance device and place the <b>{fingerLabel(session!.fingerPosition).toLowerCase()}</b> finger
                    on the scanner when prompted (three scans). Expires {new Date(session!.expiresAt).toLocaleTimeString()}.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={cancel}><X className="h-4 w-4" /> Cancel enrollment</Button>
            </div>
          ) : (
            <div className="space-y-3 p-5">
              {session && session.status !== 'CANCELLED' && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${session.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {session.status === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {session.status === 'COMPLETED' ? `${fingerLabel(session.fingerPosition)} enrolled on ${session.deviceName}.`
                    : `Enrollment ${session.status.toLowerCase()}${session.failureReason ? ` — ${session.failureReason}` : ''}.`}
                </div>
              )}
              {status.devices.length === 0 ? (
                <p className="text-sm text-amber-700">No active attendance device. Register and approve one under Attendance → Devices first.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Attendance device</span>
                    <select className={SELECT} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                      {status.devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.deviceName}{d.branchName ? ` · ${d.branchName}` : ''}{d.scannerStatus && d.scannerStatus !== 'CONNECTED' ? ' (scanner offline)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Finger</span>
                    <select className={SELECT} value={finger} onChange={(e) => setFinger(e.target.value)}>
                      {FINGERS.map((f) => <option key={f} value={f}>{fingerLabel(f)}</option>)}
                    </select>
                  </label>
                  <Button onClick={start} disabled={busy} className="h-10">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                    {status.enrolled ? 'Enroll another finger' : 'Start enrollment'}
                  </Button>
                </div>
              )}
              <p className="flex items-start gap-2 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Fingerprint images are never stored. The scanner creates an encrypted template that stays on the device;
                ArudraCS keeps only a reference to it. Enrol a second finger as a fallback.
              </p>
            </div>
          )}

          {active.length > 0 && (
            <ul className="divide-y border-t">
              {active.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{fingerLabel(e.fingerPosition)}</div>
                    <div className="text-xs text-slate-500">
                      <Router className="mr-1 inline h-3 w-3" />{e.deviceName ?? '—'} · Quality {e.qualityScore ?? '—'} · Enrolled {fmt(e.enrolledAt)} by {e.enrolledBy ?? '—'}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" aria-label="Remove fingerprint" onClick={() => removeOne(e.id)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
          {active.length > 0 && (
            <div className="border-t px-4 py-3">
              <Button size="sm" variant="outline" className="text-rose-700" onClick={removeAll}><Trash2 className="h-4 w-4" /> Remove all fingerprints</Button>
            </div>
          )}
        </Panel>

        {(history.length > 0 || status.sessions.length > 0) && (
          <Panel>
            <header className="border-b px-4 py-3 text-sm font-semibold text-slate-900">Biometric history</header>
            <ul className="divide-y text-sm">
              {status.sessions.map((s) => (
                <li key={`s${s.id}`} className="flex justify-between gap-3 px-4 py-2.5">
                  <span>Enrollment ({fingerLabel(s.fingerPosition)}) on {s.deviceName} — <b>{s.status.toLowerCase().replace('_', ' ')}</b>{s.failureReason ? `: ${s.failureReason}` : ''}</span>
                  <span className="shrink-0 text-xs text-slate-500">{fmt(s.createdAt)} · {s.requestedBy}</span>
                </li>
              ))}
              {history.map((e) => (
                <li key={`e${e.id}`} className="flex justify-between gap-3 px-4 py-2.5 text-slate-600">
                  <span>{fingerLabel(e.fingerPosition)} on {e.deviceName ?? '—'} removed</span>
                  <span className="shrink-0 text-xs text-slate-500">{fmt(e.revokedAt)} · {e.revokedBy}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <Panel className="h-fit">
        <header className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-primary" /> Attendance setup
        </header>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Branch</span>
            <select className={SELECT} value={status.branchId ?? ''} onChange={(e) => e.target.value && assign({ branchId: e.target.value })}>
              <option value="">Not assigned</option>
              {branches.filter((b) => b.active || b.id === status.branchId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="mt-1 block text-[11px] text-muted-foreground">Devices only accept punches from their own branch.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Shift</span>
            <select className={SELECT} value={status.shiftId ?? 'DEFAULT'} onChange={(e) => assign({ shiftId: e.target.value })}>
              <option value="DEFAULT">Default shift</option>
              {shifts.filter((s) => s.active || s.id === status.shiftId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {status.devices.length > 0 && (
            <div className="text-xs text-slate-500">
              {status.devices.map((d) => (
                <div key={d.id}>{d.deviceName}: seen {timeAgo(d.lastSeenAt)}</div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
