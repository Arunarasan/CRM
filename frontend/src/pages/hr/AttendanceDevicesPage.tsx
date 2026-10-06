import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Router, Plus, Loader2, Check, X, MoreHorizontal, Ban, ShieldOff, History, Pencil, Trash2, KeyRound,
  Building2, Fingerprint, Unlock, Copy, AlertTriangle,
} from 'lucide-react';
import {
  attendanceDeviceApi, timeAgo, type AttendanceDevice, type Branch, type DeviceEvent, type PairingResponse,
} from '@/api/attendanceDeviceApi';
import { attendanceApi, type AttendanceLocation } from '@/api/attendanceApi';
import { Button } from '@/components/ui/button';
import { BaseInput } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterChips, Panel, SectionHeader } from '@/pages/workforce/hrUi';

/**
 * HR → Attendance → Devices. Registered attendance terminals and every security action on them.
 * Only ACTIVE devices can record attendance; blocking or revoking takes effect on the device's next
 * request. New registration requests wait here for approval.
 */
const INPUT = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const errMsg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;
const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const STATUS_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  ACTIVE: { label: 'Online', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  OFFLINE: { label: 'Offline', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  BLOCKED: { label: 'Blocked', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  REVOKED: { label: 'Revoked', cls: 'bg-slate-200 text-slate-600', dot: 'bg-slate-500' },
  REJECTED: { label: 'Rejected', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

function DeviceStatus({ d }: { d: AttendanceDevice }) {
  const key = d.awaitingPairing ? 'PENDING' : d.effectiveStatus;
  const s = STATUS_STYLE[key] ?? STATUS_STYLE.OFFLINE;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {d.awaitingPairing ? 'Awaiting pairing' : s.label}
    </span>
  );
}

function ScannerStatus({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const ok = status === 'CONNECTED';
  return <span className={`text-xs font-medium ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>{ok ? '● Connected' : `● ${status.replace(/_/g, ' ').toLowerCase()}`}</span>;
}

type StatusFilter = 'all' | 'PENDING' | 'ACTIVE' | 'OFFLINE' | 'BLOCKED' | 'REVOKED';

export default function AttendanceDevicesPage() {
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [busy, setBusy] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ device: AttendanceDevice | null; mode: 'register' | 'edit' | 'approve' } | null>(null);
  const [pairing, setPairing] = useState<PairingResponse | null>(null);
  const [activityFor, setActivityFor] = useState<AttendanceDevice | null>(null);
  const [params] = useSearchParams();
  const focusId = Number(params.get('focus')) || null;

  const load = useCallback(() => {
    attendanceDeviceApi.list().then(setDevices).catch((e) => toast.error(errMsg(e, 'Could not load devices'))).finally(() => setLoading(false));
  }, []);
  const loadRefs = useCallback(() => {
    attendanceDeviceApi.branches().then(setBranches).catch(() => setBranches([]));
    attendanceApi.listLocations().then(setLocations).catch(() => setLocations([]));
  }, []);

  useEffect(() => { load(); loadRefs(); }, [load, loadRefs]);
  useEffect(() => { const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    devices.forEach((d) => { const k = d.awaitingPairing ? 'PENDING' : d.effectiveStatus; c[k] = (c[k] ?? 0) + 1; });
    return c;
  }, [devices]);
  const pending = devices.filter((d) => d.status === 'PENDING');
  const shown = devices.filter((d) => filter === 'all' || (d.awaitingPairing ? 'PENDING' : d.effectiveStatus) === filter);

  const act = async (d: AttendanceDevice, fn: () => Promise<unknown>, ok: string) => {
    setBusy(d.id);
    try { await fn(); toast.success(ok); load(); } catch (e) { toast.error(errMsg(e, 'Action failed')); } finally { setBusy(null); }
  };
  const reject = (d: AttendanceDevice) => {
    const reason = window.prompt(`Reject ${d.deviceName}? Reason (optional):`);
    if (reason === null) return;
    act(d, () => attendanceDeviceApi.reject(d.id, reason || undefined), 'Registration rejected');
  };
  const block = (d: AttendanceDevice) => {
    const reason = window.prompt(`Block ${d.deviceName}? It stops recording attendance immediately.\nReason:`);
    if (reason === null) return;
    act(d, () => attendanceDeviceApi.block(d.id, reason || undefined), 'Device blocked');
  };
  const revoke = (d: AttendanceDevice) => {
    const reason = window.prompt(`Revoke ${d.deviceName}?\n\nIts credential is destroyed and the fingerprints enrolled on it are removed. `
      + 'The device must be registered again to be used. This cannot be undone.\n\nReason:');
    if (reason === null) return;
    act(d, () => attendanceDeviceApi.revoke(d.id, reason || undefined), 'Device revoked');
  };
  const remove = (d: AttendanceDevice) => {
    if (!window.confirm(`Delete ${d.deviceName} from the list?`)) return;
    act(d, () => attendanceDeviceApi.remove(d.id), 'Device deleted');
  };
  const newCode = async (d: AttendanceDevice) => {
    try { setPairing(await attendanceDeviceApi.newPairingCode(d.id)); load(); } catch (e) { toast.error(errMsg(e, 'Could not issue a code')); }
  };

  return (
    <div className="space-y-5">
      <SectionHeader icon={Router} title="Attendance devices"
        description="Office attendance terminals with fingerprint scanners. Only approved, active devices can record attendance."
        actions={<Button onClick={() => setEditing({ device: null, mode: 'register' })}><Plus className="h-4 w-4" /> Register device</Button>} />

      {pending.length > 0 && (
        <Panel className="border-amber-200 bg-amber-50/40">
          <div className="border-b border-amber-200 px-4 py-3 text-sm font-semibold text-amber-900">
            {pending.length} device{pending.length > 1 ? 's' : ''} waiting for approval
          </div>
          <ul className="divide-y divide-amber-100">
            {pending.map((d) => (
              <li key={d.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${focusId === d.id ? 'bg-amber-100/50' : ''}`}>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{d.deviceName}</div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    {d.deviceCode} · Branch: <b>{d.branchName ?? '—'}</b> · Location: {d.locationName ?? '—'} · Requested {fmtDate(d.registeredAt)}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    Terminal shows Device ID <b className="font-mono tracking-wider">{(d.deviceUuid ?? '').slice(0, 8).toUpperCase()}</b> — check it matches before approving.
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                    {[d.manufacturer, d.model, d.osVersion && `Android ${d.osVersion}`, d.scannerVendor && `${d.scannerVendor} ${d.scannerModel ?? ''}`, d.lastIp].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => reject(d)}><X className="h-4 w-4" /> Reject</Button>
                  <Button size="sm" disabled={busy === d.id} onClick={() => setEditing({ device: d, mode: 'approve' })}>
                    {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <FilterChips<StatusFilter> value={filter} onChange={setFilter} options={[
        { key: 'all', label: 'All', count: devices.length },
        { key: 'ACTIVE', label: 'Online', count: counts.ACTIVE ?? 0 },
        { key: 'OFFLINE', label: 'Offline', count: counts.OFFLINE ?? 0 },
        { key: 'PENDING', label: 'Pending', count: counts.PENDING ?? 0 },
        { key: 'BLOCKED', label: 'Blocked', count: counts.BLOCKED ?? 0 },
        { key: 'REVOKED', label: 'Revoked', count: counts.REVOKED ?? 0 },
      ]} />

      <Panel>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {devices.length === 0
              ? <>No attendance devices yet. <b>Register device</b> to get a pairing code, or open the ArudraCS Attendance app on the terminal to send a request.</>
              : 'No devices in this view.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Device</th>
                  <th className="px-3 py-2.5">Branch / location</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Last seen</th>
                  <th className="px-3 py-2.5">Scanner</th>
                  <th className="px-3 py-2.5">App</th>
                  <th className="px-3 py-2.5">Last sync</th>
                  <th className="px-3 py-2.5">Registered</th>
                  <th className="px-3 py-2.5">Approved by</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((d) => (
                  <tr key={d.id} className={focusId === d.id ? 'bg-primary/5' : 'hover:bg-slate-50/60'}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{d.deviceName}</div>
                      <div className="text-xs text-slate-500">{d.deviceCode}</div>
                      <div className="max-w-[14rem] truncate font-mono text-[10px] text-slate-400" title={d.deviceUuid ?? ''}>{d.deviceUuid ?? 'not paired yet'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-slate-800">{d.branchName ?? '—'}</div>
                      <div className="text-xs text-slate-500">{d.locationName ?? '—'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <DeviceStatus d={d} />
                      {d.statusReason && <div className="mt-1 max-w-[12rem] truncate text-[11px] text-slate-500" title={d.statusReason}>{d.statusReason}</div>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600" title={d.lastSeenAt ?? ''}>{d.deviceUuid ? timeAgo(d.lastSeenAt) : '—'}</td>
                    <td className="px-3 py-3">
                      <ScannerStatus status={d.scannerStatus} />
                      {d.scannerModel && <div className="text-[11px] text-slate-500">{[d.scannerVendor, d.scannerModel].filter(Boolean).join(' ')}</div>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">{d.appVersion ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {fmtDateTime(d.lastSyncAt)}
                      {!!d.pendingSyncCount && <div className="text-amber-700">{d.pendingSyncCount} pending</div>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">{fmtDate(d.registeredAt)}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {d.approvedBy ?? '—'}
                      <div className="flex items-center gap-1 text-slate-400"><Fingerprint className="h-3 w-3" /> {d.enrolledCount} enrolled</div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label={`Actions for ${d.deviceName}`} disabled={busy === d.id}>
                            {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {d.status === 'PENDING' && <DropdownMenuItem onClick={() => setEditing({ device: d, mode: 'approve' })}><Check className="mr-2 h-4 w-4" /> Approve</DropdownMenuItem>}
                          {d.status === 'PENDING' && <DropdownMenuItem onClick={() => reject(d)}><X className="mr-2 h-4 w-4" /> Reject</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => setEditing({ device: d, mode: 'edit' })}><Pencil className="mr-2 h-4 w-4" /> Rename / assign</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setActivityFor(d)}><History className="mr-2 h-4 w-4" /> View activity</DropdownMenuItem>
                          {d.awaitingPairing && <DropdownMenuItem onClick={() => newCode(d)}><KeyRound className="mr-2 h-4 w-4" /> New pairing code</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          {(d.status === 'ACTIVE' || d.status === 'PENDING') && <DropdownMenuItem onClick={() => block(d)} className="text-rose-700"><Ban className="mr-2 h-4 w-4" /> Block</DropdownMenuItem>}
                          {d.status === 'BLOCKED' && <DropdownMenuItem onClick={() => act(d, () => attendanceDeviceApi.unblock(d.id), 'Device unblocked')}><Unlock className="mr-2 h-4 w-4" /> Unblock</DropdownMenuItem>}
                          {d.status !== 'REVOKED' && d.status !== 'REJECTED' && <DropdownMenuItem onClick={() => revoke(d)} className="text-rose-700"><ShieldOff className="mr-2 h-4 w-4" /> Revoke</DropdownMenuItem>}
                          {(d.status !== 'ACTIVE' || d.awaitingPairing) && <DropdownMenuItem onClick={() => remove(d)} className="text-rose-700"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <BranchesPanel branches={branches} onChanged={loadRefs} />

      {editing && (
        <DeviceDialog mode={editing.mode} device={editing.device} branches={branches} locations={locations}
          onClose={() => setEditing(null)}
          onDone={(res) => { setEditing(null); load(); if (res) setPairing(res); }} />
      )}
      {pairing && <PairingDialog pairing={pairing} onClose={() => setPairing(null)} />}
      {activityFor && <ActivityDialog device={activityFor} onClose={() => setActivityFor(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ dialogs */

function DeviceDialog({ mode, device, branches, locations, onClose, onDone }: {
  mode: 'register' | 'edit' | 'approve'; device: AttendanceDevice | null; branches: Branch[]; locations: AttendanceLocation[];
  onClose: () => void; onDone: (pairing?: PairingResponse) => void;
}) {
  const [name, setName] = useState(device?.deviceName ?? '');
  const [branchId, setBranchId] = useState<number | ''>(device?.branchId ?? '');
  const [locationId, setLocationId] = useState<number | ''>(device?.locationId ?? '');
  const [saving, setSaving] = useState(false);
  const branchLocations = locations.filter((l) => l.active && (!branchId || !l.branch?.id || l.branch.id === branchId));

  const submit = async () => {
    if (!branchId) return toast.error('Select a branch.');
    if (!locationId) return toast.error('Select an attendance location.');
    setSaving(true);
    try {
      const body = { deviceName: name.trim() || undefined, branchId: Number(branchId), locationId: Number(locationId) };
      if (mode === 'register') {
        if (!name.trim()) { toast.error('Give the device a name.'); setSaving(false); return; }
        onDone(await attendanceDeviceApi.register({ ...body, deviceName: name.trim() }));
        return;
      }
      if (mode === 'approve') await attendanceDeviceApi.approve(device!.id, body);
      else await attendanceDeviceApi.update(device!.id, body);
      toast.success(mode === 'approve' ? 'Device approved — it activates on its next check-in' : 'Device updated');
      onDone();
    } catch (e) {
      toast.error(errMsg(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'register' ? 'Register attendance device' : mode === 'approve' ? `Approve ${device?.deviceName}` : `Edit ${device?.deviceName}`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'register'
              ? 'Creates an approved device slot and a one-time pairing code to type into the terminal app.'
              : mode === 'approve'
                ? 'Confirm where this terminal is installed. It can record attendance once approved.'
                : 'Rename the device or move it to another branch / location.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Device name</span>
            <BaseInput className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="ARUDRA-ATTENDANCE-01" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Branch</span>
            <select className={INPUT} value={branchId} onChange={(e) => { setBranchId(e.target.value ? Number(e.target.value) : ''); setLocationId(''); }}>
              <option value="">Select branch…</option>
              {branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Attendance location</span>
            <select className={INPUT} value={locationId} onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select location…</option>
              {branchLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            {branchLocations.length === 0 && (
              <span className="mt-1 block text-[11px] text-amber-700">No active location for this branch — add one under Attendance → Review &amp; locations.</span>
            )}
          </label>
          {branches.length === 0 && <p className="text-xs text-amber-700">Add a branch first (Branches, below the device list).</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'register' ? 'Create pairing code' : mode === 'approve' ? 'Approve device' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PairingDialog({ pairing, onClose }: { pairing: PairingResponse; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pair {pairing.device.deviceName}</DialogTitle>
          <DialogDescription>
            On the terminal, open ArudraCS Attendance → <b>I have a pairing code</b> and enter this code. It works once and expires {new Date(pairing.pairingExpiresAt).toLocaleString()}.
          </DialogDescription>
        </DialogHeader>
        <div className="my-2 flex items-center justify-center gap-3 rounded-xl border bg-slate-50 py-6">
          <span className="font-mono text-3xl font-bold tracking-[0.2em] text-slate-900">{pairing.pairingCode}</span>
          <Button variant="ghost" size="sm" aria-label="Copy code" onClick={() => navigator.clipboard?.writeText(pairing.pairingCode).then(() => toast.success('Copied'))}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          The code is shown only now. If it is lost, issue a new one from the device's actions menu.
        </p>
        <div className="mt-3 flex justify-end"><Button onClick={onClose}>Done</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function ActivityDialog({ device, onClose }: { device: AttendanceDevice; onClose: () => void }) {
  const [events, setEvents] = useState<DeviceEvent[] | null>(null);
  useEffect(() => {
    attendanceDeviceApi.activity(device.id, 200).then(setEvents).catch(() => setEvents([]));
  }, [device.id]);
  const tone = (t: string) =>
    /BLOCK|REVOK|REJECT|FAIL|OFFLINE|DISCONNECTED|ERROR|DENIED/.test(t) ? 'text-rose-700'
      : /CHECK_IN|CHECK_OUT|APPROVED|ENROLLED|ONLINE|ACTIVATED|CONNECTED/.test(t) ? 'text-emerald-700' : 'text-slate-700';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{device.deviceName} — activity</DialogTitle>
          <DialogDescription>{device.deviceCode} · registrations, approvals, punches, enrollments and security events.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {events == null ? (
            <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : events.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No activity yet.</div>
          ) : (
            <ol className="divide-y text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-xs tabular-nums text-slate-500">{fmtDateTime(e.occurredAt)}</span>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${tone(e.eventType)}`}>{e.eventType.replace(/_/g, ' ')}</div>
                    <div className="text-slate-700">{e.message}</div>
                    <div className="text-[11px] text-slate-400">{[e.actor, e.ipAddress].filter(Boolean).join(' · ')}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ branches */

function BranchesPanel({ branches, onChanged }: { branches: Branch[]; onChanged: () => void }) {
  const [draft, setDraft] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!draft?.name.trim()) return toast.error('Branch name is required.');
    setSaving(true);
    try { await attendanceDeviceApi.saveBranch(draft); toast.success('Branch saved'); setDraft(null); onChanged(); }
    catch (e) { toast.error(errMsg(e, 'Save failed')); } finally { setSaving(false); }
  };
  const remove = async (b: Branch) => {
    if (!b.id || !window.confirm(`Delete branch ${b.name}?`)) return;
    try { await attendanceDeviceApi.deleteBranch(b.id); onChanged(); } catch (e) { toast.error(errMsg(e, 'Delete failed')); }
  };
  return (
    <Panel>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Building2 className="h-4 w-4 text-primary" /> Branches</h3>
        {!draft && <Button size="sm" variant="outline" onClick={() => setDraft({ name: '', code: '', city: '', active: true })}><Plus className="h-4 w-4" /> Add branch</Button>}
      </header>
      {draft && (
        <div className="grid gap-2 border-b bg-slate-50 p-4 sm:grid-cols-4">
          <BaseInput className={INPUT} placeholder="Name (e.g. Cuddalore)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <BaseInput className={INPUT} placeholder="Code (optional)" value={draft.code ?? ''} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          <BaseInput className={INPUT} placeholder="City" value={draft.city ?? ''} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active</label>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
          </div>
        </div>
      )}
      {branches.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No branches yet. Devices, attendance locations and employees are assigned to a branch.</p>
      ) : (
        <ul className="divide-y">
          {branches.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                <b className="text-slate-900">{b.name}</b>
                <span className="text-slate-500">{[b.code, b.city].filter(Boolean).length ? ` · ${[b.code, b.city].filter(Boolean).join(' · ')}` : ''}</span>
                {!b.active && <span className="ml-2 rounded bg-slate-100 px-1.5 text-[11px] text-slate-500">inactive</span>}
              </span>
              <span className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" aria-label={`Edit ${b.name}`} onClick={() => setDraft({ ...b })}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" aria-label={`Delete ${b.name}`} onClick={() => remove(b)}><Trash2 className="h-4 w-4" /></Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
