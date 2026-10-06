import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Plus, Loader2, Pencil, Trash2, Star, Users } from 'lucide-react';
import { attendanceDeviceApi, fmtClock, fmtMinutes, type Branch, type Shift } from '@/api/attendanceDeviceApi';
import { Button } from '@/components/ui/button';
import { BaseInput } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Panel, SearchField, SectionHeader } from '@/pages/workforce/hrUi';

/**
 * HR → Attendance → Shifts. Shift rules drive late / early-departure / overtime / half-day on every
 * biometric punch. Employees without a shift use the default shift.
 */
const INPUT = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const errMsg = (e: any, f: string) => e?.response?.data?.message || e?.message || f;

const EMPTY: Shift = {
  name: '', startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15, breakMinutes: 60, overtimeEnabled: true,
  halfDayThresholdMinutes: 240, weekOffDays: 'SUNDAY', defaultShift: false, active: true,
};

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const spanMinutes = (s: string, e: string) => { const d = toMin(e) - toMin(s); return d <= 0 ? d + 1440 : d; };
const to12h = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export default function AttendanceShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Shift | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const load = useCallback(() => {
    attendanceDeviceApi.shifts().then(setShifts).catch((e) => toast.error(errMsg(e, 'Could not load shifts'))).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const remove = async (s: Shift) => {
    if (!s.id || !window.confirm(`Delete shift ${s.name}? Employees on it fall back to the default shift.`)) return;
    try { await attendanceDeviceApi.deleteShift(s.id); load(); } catch (e) { toast.error(errMsg(e, 'Delete failed')); }
  };

  return (
    <div className="space-y-5">
      <SectionHeader icon={Clock} title="Shifts"
        description="Working hours, grace period and breaks used to calculate late arrival, early departure, working hours and overtime."
        actions={<>
          <Button variant="outline" onClick={() => setAssignOpen(true)}><Users className="h-4 w-4" /> Assign employees</Button>
          <Button onClick={() => setDraft({ ...EMPTY })}><Plus className="h-4 w-4" /> New shift</Button>
        </>} />

      <Panel>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : shifts.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No shifts yet. Create one to start calculating late arrivals and overtime.</div>
        ) : (
          <ul className="divide-y">
            {shifts.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{s.name}</span>
                    {s.defaultShift && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"><Star className="h-3 w-3" /> Default</span>}
                    {!s.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Inactive</span>}
                  </div>
                  <div className="mt-1 text-sm tabular-nums text-slate-700">
                    {to12h(fmtClock(s.startTime))} – {to12h(fmtClock(s.endTime))}
                    {toMin(fmtClock(s.endTime)) <= toMin(fmtClock(s.startTime)) && <span className="ml-1 text-xs text-slate-500">(overnight)</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Grace {s.gracePeriodMinutes} min · Break {s.breakMinutes} min · {Number(s.workingHours ?? 0).toFixed(2)} working hours
                    {' '}· Overtime {s.overtimeEnabled ? 'on' : 'off'} · Half day under {fmtMinutes(s.halfDayThresholdMinutes)}
                    {' '}· Weekly off {s.weekOffDays ? s.weekOffDays.split(',').map((d) => d.slice(0, 3).toLowerCase()).join(', ') : 'none'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-slate-500">{s.employeeCount ?? 0} assigned</span>
                  <Button size="sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setDraft({ ...s, startTime: fmtClock(s.startTime), endTime: fmtClock(s.endTime) })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {draft && <ShiftDialog shift={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />}
      {assignOpen && <AssignDialog shifts={shifts} onClose={() => setAssignOpen(false)} onDone={() => { setAssignOpen(false); load(); }} />}
    </div>
  );
}

function ShiftDialog({ shift, onClose, onSaved }: { shift: Shift; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState<Shift>(shift);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Shift>(k: K, v: Shift[K]) => setS((p) => ({ ...p, [k]: v }));
  const span = spanMinutes(s.startTime, s.endTime);
  const net = Math.max(0, span - (s.breakMinutes || 0));
  const offs = new Set((s.weekOffDays || '').split(',').filter(Boolean));
  const toggleDay = (d: string) => {
    const n = new Set(offs);
    if (n.has(d)) n.delete(d); else n.add(d);
    set('weekOffDays', DAYS.filter((x) => n.has(x)).join(','));
  };

  const save = async () => {
    if (!s.name.trim()) return toast.error('Name the shift.');
    if ((s.breakMinutes || 0) >= span) return toast.error('Break must be shorter than the shift.');
    setSaving(true);
    try {
      await attendanceDeviceApi.saveShift({ ...s, startTime: `${s.startTime}:00`.slice(0, 8), endTime: `${s.endTime}:00`.slice(0, 8) });
      toast.success('Shift saved');
      onSaved();
    } catch (e) { toast.error(errMsg(e, 'Save failed')); } finally { setSaving(false); }
  };

  const num = (k: 'gracePeriodMinutes' | 'breakMinutes' | 'halfDayThresholdMinutes', label: string, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <BaseInput type="number" min={0} className={INPUT} value={s[k]} onChange={(e) => set(k, Math.max(0, Number(e.target.value) || 0))} />
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{s.id ? `Edit ${shift.name}` : 'New shift'}</DialogTitle>
          <DialogDescription>Late = check-in after start + grace. Overtime = worked time beyond the shift's working hours.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
            <BaseInput className={INPUT} value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="General Shift" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Start</span>
            <BaseInput type="time" className={INPUT} value={s.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">End</span>
            <BaseInput type="time" className={INPUT} value={s.endTime} onChange={(e) => set('endTime', e.target.value)} />
          </label>
          {num('gracePeriodMinutes', 'Grace period (min)')}
          {num('breakMinutes', 'Break (min)', 'Unpaid; deducted on a full day.')}
          {num('halfDayThresholdMinutes', 'Half day below (min)', `A day shorter than ${fmtMinutes(s.halfDayThresholdMinutes)} is a half day.`)}
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Working hours</div>
            <div className="font-semibold tabular-nums text-slate-900">{fmtMinutes(net)}</div>
            <div className="text-[11px] text-slate-500">{fmtMinutes(span)} span − {s.breakMinutes} min break</div>
          </div>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Weekly off</span>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button key={d} type="button" onClick={() => toggleDay(d)} aria-pressed={offs.has(d)}
                  className={`h-9 rounded-full border px-3 text-xs font-medium ${offs.has(d) ? 'border-primary bg-primary text-primary-foreground' : 'border-slate-200 bg-card text-slate-600'}`}>
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.overtimeEnabled} onChange={(e) => set('overtimeEnabled', e.target.checked)} /> Overtime enabled</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.defaultShift} onChange={(e) => set('defaultShift', e.target.checked)} /> Default shift</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.active} onChange={(e) => set('active', e.target.checked)} /> Active</label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save shift</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ shifts, onClose, onDone }: { shifts: Shift[]; onClose: () => void; onDone: () => void }) {
  const [employees, setEmployees] = useState<{ id: number; name: string; code: string }[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [shiftId, setShiftId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    attendanceDeviceApi.employees()
      .then((list) => setEmployees(list.map((e) => ({ id: e.id, code: e.employeeCode, name: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() }))))
      .catch(() => setEmployees([]));
    attendanceDeviceApi.branches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? employees.filter((e) => `${e.name} ${e.code}`.toLowerCase().includes(q)) : employees;
  }, [employees, search]);
  const toggle = (id: number) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allVisible = visible.length > 0 && visible.every((e) => selected.has(e.id));

  const save = async () => {
    if (selected.size === 0) return toast.error('Select employees.');
    if (!shiftId && !branchId) return toast.error('Choose a shift and/or a branch.');
    setSaving(true);
    try {
      const res = await attendanceDeviceApi.assign({
        employeeIds: [...selected],
        shiftId: shiftId && shiftId !== 'DEFAULT' ? Number(shiftId) : undefined,
        useDefaultShift: shiftId === 'DEFAULT',
        branchId: branchId ? Number(branchId) : undefined,
      });
      toast.success(`Updated ${res.updated} employee${res.updated === 1 ? '' : 's'}`);
      onDone();
    } catch (e) { toast.error(errMsg(e, 'Assignment failed')); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign shift / branch</DialogTitle>
          <DialogDescription>Pick employees, then the shift and/or branch to apply.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={INPUT} value={shiftId} onChange={(e) => setShiftId(e.target.value)} aria-label="Shift">
            <option value="">Keep current shift</option>
            <option value="DEFAULT">Use default shift</option>
            {shifts.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={INPUT} value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Branch">
            <option value="">Keep current branch</option>
            {branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <SearchField value={search} onChange={setSearch} placeholder="Search employees" />
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          <label className="flex items-center gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={allVisible}
              onChange={() => setSelected((p) => { const n = new Set(p); visible.forEach((e) => (allVisible ? n.delete(e.id) : n.add(e.id))); return n; })} />
            Select all shown ({visible.length})
          </label>
          {visible.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
              <span className="min-w-0 truncate">{e.name}</span>
              <span className="ml-auto text-xs text-slate-400">{e.code}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Apply</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
