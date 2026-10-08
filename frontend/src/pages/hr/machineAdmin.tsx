import { useCallback, useEffect, useState } from 'react';
import {
  Fingerprint, Plus, Pencil, Trash2, Loader2, Check, X, Wifi, WifiOff, Link2, ListOrdered, ChevronDown, ChevronUp,
  RotateCcw, Info,
} from 'lucide-react';
import {
  attendanceApi, AttendanceLocation, AttendanceMachine, MachineConnectionRequest, MachineInput, MachinePunchRow,
  UnmatchedMachineId,
} from '@/api/attendanceApi';
import { BaseInput } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SearchableSelect from '@/components/ui/searchable-select';
import { toast } from '@/components/ui/toast';

/**
 * HR side of the office fingerprint machine (ZKTeco / eSSL over ADMS push): the machines themselves,
 * machines trying to connect, machine IDs nobody is linked to, the punch log, and the per-employee
 * Machine ID card on the profile. The machine identifies the finger; the CRM only receives punches.
 */

const INPUT = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const errText = (e: any, fallback = 'Action failed') => e?.response?.data?.message || e?.message || fallback;

function when(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

type EmpOption = { value: string; label: string; hint?: string };

function useEmployeeOptions(enabled: boolean) {
  const [emps, setEmps] = useState<EmpOption[]>([]);
  useEffect(() => {
    if (!enabled || emps.length) return;
    attendanceApi.listEmployees()
      .then((list) => setEmps(list.map((e) => ({
        value: String(e.id), label: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || `#${e.id}`, hint: e.employeeCode,
      }))))
      .catch(() => setEmps([]));
  }, [enabled, emps.length]);
  return emps;
}

/* ------------------------------------ Machines ------------------------------------ */

const EMPTY: MachineInput = { serialNumber: '', name: '', timeZone: 'Asia/Kolkata', officeLocationId: null, allowedIp: '', useInOutKeys: false, active: true };

/** Machines list + add/edit, with the exact settings to type into the machine. */
export function FingerprintMachines() {
  const [rows, setRows] = useState<AttendanceMachine[]>([]);
  const [requests, setRequests] = useState<MachineConnectionRequest[]>([]);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: number | null; draft: MachineInput } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      attendanceApi.listMachines().catch(() => []),
      attendanceApi.machineConnectionRequests().catch(() => []),
    ]).then(([m, r]) => { setRows(m); setRequests(r); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    attendanceApi.listLocations().then(setLocations).catch(() => setLocations([]));
    const t = window.setInterval(load, 30000); // online dots stay current
    return () => window.clearInterval(t);
  }, [load]);

  const startAdd = (serialNumber = '') => setEditing({ id: null, draft: { ...EMPTY, serialNumber } });
  const startEdit = (m: AttendanceMachine) => setEditing({
    id: m.id,
    draft: {
      serialNumber: m.serialNumber, name: m.name, timeZone: m.timeZone, officeLocationId: m.officeLocationId,
      allowedIp: m.allowedIp ?? '', useInOutKeys: m.useInOutKeys, active: m.active, model: m.model,
    },
  });
  const set = <K extends keyof MachineInput>(k: K, v: MachineInput[K]) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e));

  const save = async () => {
    if (!editing) return;
    const d = editing.draft;
    if (!d.serialNumber.trim()) return toast.error('Enter the machine serial number.');
    if (!d.name.trim()) return toast.error('Give the machine a name.');
    setSaving(true);
    try {
      editing.id == null ? await attendanceApi.createMachine(d) : await attendanceApi.updateMachine(editing.id, d);
      toast.success(editing.id == null ? 'Machine added — it turns green once it connects' : 'Machine saved');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(errText(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: AttendanceMachine) => {
    if (!window.confirm(`Remove "${m.name}"? It will stop sending punches. Its punch history is kept.`)) return;
    try { await attendanceApi.deleteMachine(m.id); toast.success('Machine removed'); load(); }
    catch (e) { toast.error(errText(e)); }
  };

  const dismiss = async (r: MachineConnectionRequest) => {
    try { await attendanceApi.dismissMachineRequest(r.id); setRequests((p) => p.filter((x) => x.id !== r.id)); }
    catch (e) { toast.error(errText(e)); }
  };

  const host = typeof window !== 'undefined' ? window.location.hostname : 'your-crm-domain';

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Fingerprint machines</h2>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => startAdd()}><Plus className="h-4 w-4" /> Add machine</Button>
        )}
      </header>

      {requests.length > 0 && (
        <div className="space-y-2 border-b bg-amber-50/60 px-4 py-3 sm:px-5">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
              <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="flex-1">
                New machine trying to connect: <b className="font-mono">{r.serialNumber}</b>
                <span className="text-muted-foreground"> · {r.lastIp ?? 'unknown IP'} · last tried {when(r.lastSeenAt)}</span>
              </span>
              <Button size="sm" variant="forest" onClick={() => startAdd(r.serialNumber)}><Plus className="h-4 w-4" /> Add</Button>
              <Button size="sm" variant="ghost" onClick={() => dismiss(r)}>Dismiss</Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="space-y-4 border-b px-4 py-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Serial number (from the machine)</span>
              <BaseInput className={`${INPUT} font-mono`} value={editing.draft.serialNumber} placeholder="e.g. CQUJ223260123"
                onChange={(e) => set('serialNumber', e.target.value.trim())} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
              <BaseInput className={INPUT} value={editing.draft.name} placeholder="Main office entrance"
                onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Office</span>
              <select className={INPUT} value={editing.draft.officeLocationId ?? ''}
                onChange={(e) => set('officeLocationId', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Not linked</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Time zone set on the machine</span>
              <BaseInput className={INPUT} value={editing.draft.timeZone ?? ''} placeholder="Asia/Kolkata"
                onChange={(e) => set('timeZone', e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Only accept from IP (optional)</span>
              <BaseInput className={INPUT} value={editing.draft.allowedIp ?? ''} placeholder="Office internet IP"
                onChange={(e) => set('allowedIp', e.target.value)} />
            </label>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={!!editing.draft.useInOutKeys}
                  onChange={(e) => set('useInOutKeys', e.target.checked)} />
                Use the machine's In / Out keys
                <span className="text-xs text-muted-foreground">(otherwise in → out → in…)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={editing.draft.active !== false}
                  onChange={(e) => set('active', e.target.checked)} />
                Active
              </label>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="mb-1.5 flex items-center gap-1.5 font-medium"><Info className="h-4 w-4 text-primary" /> On the machine: Menu → Comm → Cloud Server Setting</p>
            <ul className="grid gap-x-6 gap-y-0.5 text-muted-foreground sm:grid-cols-2">
              <li>Server address: <b className="font-mono text-foreground">{host}</b></li>
              <li>Server port: <b className="font-mono text-foreground">80</b></li>
              <li>Enable domain name: <b className="text-foreground">ON</b></li>
              <li>HTTPS / Proxy: <b className="text-foreground">OFF</b></li>
            </ul>
            <p className="mt-1.5 text-xs text-muted-foreground">Also set the machine's date, time and time zone. Each employee's User ID on the machine must match their Machine ID in the CRM.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="forest" size="sm" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
            </Button>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => setEditing(null)}><X className="h-4 w-4" /> Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No machines yet. Add one with its serial number to start receiving punches.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!m.active ? 'bg-slate-300' : m.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="font-medium">{m.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{m.serialNumber}</span>
                  {!m.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Inactive</span>}
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {m.online ? <Wifi className="h-3 w-3 text-emerald-600" /> : <WifiOff className="h-3 w-3" />}
                    {m.online ? 'Online' : m.lastSeenAt ? `Last seen ${when(m.lastSeenAt)}` : 'Never connected'}
                  </span>
                  <span>{m.punchesToday ?? 0} punches today</span>
                  {m.officeLocationName && <span>{m.officeLocationName}</span>}
                  {m.lastPunchAt && <span>Last punch {when(m.lastPunchAt)}</span>}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(m)}><Pencil className="h-4 w-4" /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label="Remove machine"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------- Unmatched machine IDs ------------------------------- */

/** Machine IDs that punched but aren't linked to anyone. Hidden when there are none. */
export function UnmatchedMachineIds() {
  const [rows, setRows] = useState<UnmatchedMachineId[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const emps = useEmployeeOptions(rows.length > 0);

  useEffect(() => { attendanceApi.unmatchedMachineIds().then(setRows).catch(() => setRows([])); }, []);

  const link = async (pin: string) => {
    const empId = picked[pin];
    if (!empId) return toast.error('Pick the employee first.');
    setBusy(pin);
    try {
      const r = await attendanceApi.setMachinePin(Number(empId), pin);
      toast.success(`Linked — ${r.linkedPunches} earlier punch${r.linkedPunches === 1 ? '' : 'es'} added to attendance`);
      setRows((p) => p.filter((x) => x.machinePin !== pin));
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return null;
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5 sm:py-4">
        <Link2 className="h-5 w-5 text-amber-500" />
        <h2 className="text-base font-semibold">Machine IDs not linked to anyone</h2>
        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{rows.length}</span>
      </header>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.machinePin} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-medium">ID <span className="font-mono">{r.machinePin}</span></span>
              <span className="text-muted-foreground"> · {r.punches} punch{r.punches === 1 ? '' : 'es'} · {when(r.firstPunchAt)} – {when(r.lastPunchAt)}</span>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-64">
                <SearchableSelect value={picked[r.machinePin] ?? ''} options={emps} placeholder="Whose ID is this?"
                  onChange={(v) => setPicked((p) => ({ ...p, [r.machinePin]: v }))} />
              </div>
              <Button size="sm" variant="forest" disabled={busy === r.machinePin} onClick={() => link(r.machinePin)}>
                {busy === r.machinePin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Link
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------ Punch log ------------------------------------ */

const RESULT_STYLE: Record<string, string> = {
  USED: 'bg-emerald-100 text-emerald-700',
  DUPLICATE_TAP: 'bg-muted text-muted-foreground',
  UNMATCHED: 'bg-amber-100 text-amber-700',
  AFTER_CORRECTION: 'bg-amber-100 text-amber-700',
  IGNORED: 'bg-muted text-muted-foreground',
  OUT_OF_RANGE: 'bg-muted text-muted-foreground',
  PENDING: 'bg-sky-100 text-sky-700',
};
const RESULT_LABEL: Record<string, string> = {
  USED: 'Counted', DUPLICATE_TAP: 'Double touch', UNMATCHED: 'Unknown ID', AFTER_CORRECTION: 'After HR edit',
  IGNORED: 'Ignored', OUT_OF_RANGE: 'Before setup', PENDING: 'Processing',
};
const METHOD_LABEL: Record<string, string> = { FINGER: 'Finger', FACE: 'Face', CARD: 'Card', PASSWORD: 'Password', OTHER: 'Other' };

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Every punch the machines sent, newest first — collapsed by default. */
export function MachinePunchLog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<MachinePunchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ employeeId: '', from: isoDay(-7), to: isoDay(0) });
  const [reprocessing, setReprocessing] = useState(false);
  const emps = useEmployeeOptions(open);

  const load = useCallback(() => {
    setLoading(true);
    attendanceApi.machinePunches({
      employeeId: filters.employeeId ? Number(filters.employeeId) : undefined, from: filters.from, to: filters.to, limit: 300,
    }).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const reprocess = async () => {
    if (!filters.employeeId) return toast.error('Pick an employee to reprocess.');
    if (!window.confirm('Rebuild this employee\'s machine attendance for the selected dates? Days HR already edited are left as they are.')) return;
    setReprocessing(true);
    try {
      await attendanceApi.reprocessMachinePunches(Number(filters.employeeId), filters.from, filters.to);
      toast.success('Attendance rebuilt from machine punches');
      load();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left sm:px-5 sm:py-4">
        <ListOrdered className="h-5 w-5 text-primary" />
        <h2 className="flex-1 text-base font-semibold">Machine punch log</h2>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t">
          <div className="flex flex-wrap items-end gap-2 px-4 py-3 sm:px-5">
            <div className="w-full sm:w-64">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Employee</span>
              <SearchableSelect value={filters.employeeId} options={emps} placeholder="All employees" clearLabel="All employees"
                onChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))} />
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">From</span>
              <BaseInput type="date" className={INPUT} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">To</span>
              <BaseInput type="date" className={INPUT} value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
            </label>
            {filters.employeeId && (
              <Button size="sm" variant="outline" disabled={reprocessing} onClick={reprocess}>
                {reprocessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reprocess
              </Button>
            )}
          </div>
          {loading ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">No punches in this period.</p>
          ) : (
            <ul className="divide-y border-t">
              {rows.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-5">
                  <span className="w-32 shrink-0 tabular-nums">{when(p.punchTime)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {p.employeeName ?? <span className="text-amber-700">ID {p.machinePin}</span>}
                    <span className="text-xs text-muted-foreground"> · {p.machineName}{p.verifyMethod ? ` · ${METHOD_LABEL[p.verifyMethod] ?? p.verifyMethod}` : ''}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULT_STYLE[p.result] ?? 'bg-muted'}`}>
                    {RESULT_LABEL[p.result] ?? p.result}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/* --------------------------------- Profile: Machine ID --------------------------------- */

/** Employee profile card: the ID they're enrolled under on the office fingerprint machine. */
export function MachineIdCard({ employeeId, machinePin, canEdit, onChanged }: {
  employeeId: number; machinePin: string | null | undefined; canEdit: boolean; onChanged?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(machinePin ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(machinePin ?? ''); }, [machinePin]);

  const save = async () => {
    const v = value.trim();
    if (v && !/^\d{1,20}$/.test(v)) return toast.error('Machine ID must be digits only.');
    setSaving(true);
    try {
      const r = await attendanceApi.setMachinePin(employeeId, v);
      toast.success(!v ? 'Machine ID removed'
        : r.linkedPunches > 0 ? `Saved — ${r.linkedPunches} earlier punch${r.linkedPunches === 1 ? '' : 'es'} added to attendance` : 'Machine ID saved');
      setEditing(false);
      onChanged?.();
    } catch (e) {
      toast.error(errText(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-primary" /> Fingerprint machine</CardTitle>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Machine ID (User ID on the machine)</span>
              <BaseInput inputMode="numeric" className={`${INPUT} w-48 font-mono`} value={value} placeholder="e.g. 1023"
                onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} />
            </label>
            <Button size="sm" variant="forest" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
            </Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setEditing(false); setValue(machinePin ?? ''); }}>Cancel</Button>
          </div>
        ) : machinePin ? (
          <p className="text-sm">Machine ID <b className="font-mono">{machinePin}</b>
            <span className="text-muted-foreground"> — punches on the office machine under this ID count as this employee's attendance.</span></p>
        ) : (
          <p className="text-sm text-muted-foreground">Not set up. Enrol their finger on the machine, then enter the same User ID here.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Pending-approval badge ------------------------------ */

/** Number of clock-ins waiting for an admin; polls every minute. Returns 0 when not allowed. */
export function usePendingAttendanceCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = () => attendanceApi.pendingCount().then((n) => { if (alive) setCount(n); }).catch(() => {});
    tick();
    const t = window.setInterval(tick, 60000);
    return () => { alive = false; window.clearInterval(t); };
  }, [enabled]);
  return count;
}
