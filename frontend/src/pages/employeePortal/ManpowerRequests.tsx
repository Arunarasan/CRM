import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Users } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { ManpowerRequestEntry, ManpowerRequestCreateBody, MyProject } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState } from './_shared';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const EMPTY: ManpowerRequestCreateBody = {
  projectId: null, currentWorkers: '', requiredWorkers: '', skillRequired: '', reason: '', priority: 'MEDIUM', requiredDate: '',
};

export default function ManpowerRequests() {
  const [list, setList] = useState<ManpowerRequestEntry[]>([]);
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ManpowerRequestCreateBody>(EMPTY);

  const load = useCallback(() => {
    employeePortalApi.manpowerRequests().then(setList).catch(() => {});
    employeePortalApi.projects().then(setProjects).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof ManpowerRequestCreateBody>(k: K, v: ManpowerRequestCreateBody[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (!form.requiredWorkers || Number(form.requiredWorkers) <= 0) { setError('Enter how many workers you need.'); return; }
    setSaving(true);
    try {
      await employeePortalApi.createManpowerRequest({
        ...form,
        projectId: form.projectId || null,
        currentWorkers: form.currentWorkers === '' ? undefined : form.currentWorkers,
      });
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not raise the request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <PortalHeader
        title="Manpower Requests"
        action={
          <button onClick={() => { setForm(EMPTY); setError(''); setOpen(true); }} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
            <Plus className="h-4 w-4" /> New
          </button>
        }
      />

      <div className="mx-3 my-3 flex flex-col gap-2">
        {list.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm"><EmptyState message="No manpower requests yet." /></div>
        ) : (
          list.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Users className="h-4 w-4 text-indigo-600" /> {r.requiredWorkers} worker{r.requiredWorkers > 1 ? 's' : ''}
                    {r.skillRequired ? ` · ${r.skillRequired}` : ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{r.requestNumber}{r.project?.projectName ? ` · ${r.project.projectName}` : ''}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
              {r.reason && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.reason}</p>}
              {r.requiredDate && <p className="mt-1 text-[11px] text-muted-foreground">Needed by {r.requiredDate}</p>}
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-md mx-auto overflow-y-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Request Manpower</h2>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <select value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="">— Select project (optional) —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Current workers</label>
                  <input type="number" min={0} value={form.currentWorkers as string} onChange={(e) => set('currentWorkers', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Required *</label>
                  <input type="number" min={1} value={form.requiredWorkers as string} onChange={(e) => set('requiredWorkers', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Skill required</label>
                <input value={form.skillRequired} onChange={(e) => set('skillRequired', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="e.g. Carpenter, Painter" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {PRIORITIES.map((p) => (
                    <button key={p} onClick={() => set('priority', p)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.priority === p ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Needed by</label>
                <input type="date" value={form.requiredDate} onChange={(e) => set('requiredDate', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reason</label>
                <textarea value={form.reason} onChange={(e) => set('reason', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Why are extra workers needed?" />
              </div>
              <button onClick={submit} disabled={saving} className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Submitting…' : 'Raise Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
