import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, Check, Trash2, Bell } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { PersonalReminderEntry, ReminderCreateBody } from '@/types/employeePortal';
import { PortalHeader, EmptyState } from './_shared';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const FILTERS = ['ALL', 'PENDING', 'DONE'] as const;
type Filter = (typeof FILTERS)[number];
const EMPTY: ReminderCreateBody = { title: '', notes: '', dueDate: '', priority: 'MEDIUM' };

const PRIORITY_TONE: Record<string, string> = {
  HIGH: 'text-red-600', MEDIUM: 'text-amber-600', LOW: 'text-slate-500',
};

export default function TaskManagement() {
  const [list, setList] = useState<PersonalReminderEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ReminderCreateBody>(EMPTY);

  const load = useCallback(() => {
    employeePortalApi.reminders().then(setList).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof ReminderCreateBody>(k: K, v: ReminderCreateBody[K]) => setForm((f) => ({ ...f, [k]: v }));

  const shown = useMemo(
    () => list.filter((r) => filter === 'ALL' || r.status === filter),
    [list, filter],
  );

  const submit = async () => {
    setError('');
    if (!form.title.trim()) { setError('Give the reminder a title.'); return; }
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '' && v != null)) as unknown as ReminderCreateBody;
      await employeePortalApi.createReminder(body);
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not save the reminder.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: number) => employeePortalApi.toggleReminder(id).then(load).catch(() => {});
  const remove = (id: number) => employeePortalApi.deleteReminder(id).then(load).catch(() => {});

  const overdue = (r: PersonalReminderEntry) => r.status === 'PENDING' && r.dueDate && r.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col">
      <PortalHeader
        title="Task Management"
        action={
          <button onClick={() => { setForm(EMPTY); setError(''); setOpen(true); }} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
            <Plus className="h-4 w-4" /> Add
          </button>
        }
      />

      <p className="px-4 pt-3 text-xs text-muted-foreground">Your private work reminders — not visible to anyone else.</p>

      <div className="flex gap-2 px-3 py-3">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filter === f ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
            {f === 'ALL' ? 'All' : f === 'PENDING' ? 'Pending' : 'Done'}
          </button>
        ))}
      </div>

      <div className="mx-3 mb-6 flex flex-col gap-2">
        {shown.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm"><EmptyState message="No reminders here. Add one." /></div>
        ) : (
          shown.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm">
              <button onClick={() => toggle(r.id)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${r.status === 'DONE' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40'}`} aria-label="Toggle done">
                {r.status === 'DONE' && <Check className="h-3.5 w-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${r.status === 'DONE' ? 'text-muted-foreground line-through' : ''}`}>{r.title}</p>
                {r.notes && <p className="truncate text-xs text-muted-foreground">{r.notes}</p>}
                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  {r.priority && <span className={`font-medium ${PRIORITY_TONE[r.priority] ?? 'text-muted-foreground'}`}>{r.priority}</span>}
                  {r.dueDate && <span className={overdue(r) ? 'font-medium text-red-600' : 'text-muted-foreground'}>{overdue(r) ? 'Overdue · ' : ''}{r.dueDate}</span>}
                </div>
              </div>
              <button onClick={() => remove(r.id)} className="text-muted-foreground active:text-destructive" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md mx-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-semibold"><Bell className="h-4 w-4 text-primary" /> New Reminder</h2>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <input value={form.title} onChange={(e) => set('title', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="e.g. Purchase paint, Meet client" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Due date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Priority</label>
                  <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={submit} disabled={saving} className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Saving…' : 'Add Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
