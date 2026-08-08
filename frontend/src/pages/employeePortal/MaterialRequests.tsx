import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, Trash2, Search, Boxes } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { MaterialRequestEntry, MaterialOption, MyProject } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState } from './_shared';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

interface Line { productId: number; name: string; unit: string | null; quantity: number }

export default function MaterialRequests() {
  const [list, setList] = useState<MaterialRequestEntry[]>([]);
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // form state
  const [projectId, setProjectId] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [expectedDate, setExpectedDate] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

  // material typeahead
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<MaterialOption[]>([]);

  const load = useCallback(() => {
    employeePortalApi.materialRequests().then(setList).catch(() => {});
    employeePortalApi.projects().then(setProjects).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      employeePortalApi.searchMaterials(query).then(setOptions).catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const addLine = (opt: MaterialOption) => {
    setLines((ls) => (ls.some((l) => l.productId === opt.id)
      ? ls
      : [...ls, { productId: opt.id, name: opt.name, unit: opt.unit, quantity: 1 }]));
    setQuery('');
  };

  const resetForm = () => {
    setProjectId(''); setReason(''); setPriority('MEDIUM'); setExpectedDate('');
    setLines([]); setQuery(''); setError('');
  };

  const submit = async () => {
    setError('');
    if (lines.length === 0) { setError('Add at least one material.'); return; }
    if (lines.some((l) => !l.quantity || l.quantity <= 0)) { setError('Every line needs a quantity.'); return; }
    setSaving(true);
    try {
      await employeePortalApi.createMaterialRequest({
        projectId: projectId === '' ? null : projectId,
        reason: reason || undefined,
        priority,
        expectedDate: expectedDate || undefined,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      });
      setOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not raise the request.');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = useMemo(() => lines.length > 0 && !saving, [lines, saving]);

  return (
    <div className="flex flex-col">
      <PortalHeader
        title="Material Requests"
        action={
          <button onClick={() => { resetForm(); setOpen(true); }} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
            <Plus className="h-4 w-4" /> New
          </button>
        }
      />

      <div className="mx-3 my-3 flex flex-col gap-2">
        {list.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm"><EmptyState message="No material requests yet." /></div>
        ) : (
          list.map((mr) => (
            <div key={mr.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{mr.requestNumber}</p>
                  {mr.project?.projectName && <p className="truncate text-xs text-muted-foreground">{mr.project.projectName}</p>}
                </div>
                <StatusPill status={mr.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {mr.items?.map((it) => (
                  <span key={it.id} className="rounded-md bg-accent/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {it.product?.name ?? 'Item'} × {it.quantity}
                  </span>
                ))}
              </div>
              {mr.remarks && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{mr.remarks}</p>}
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-md mx-auto overflow-y-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">New Material Request</h2>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="">— Select project (optional) —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                </select>
              </div>

              {/* Material picker */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Materials</label>
                <div className="mt-1 flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search material…" className="flex-1 bg-transparent text-sm outline-none" />
                </div>
                {query && options.length > 0 && (
                  <div className="mt-1 max-h-40 divide-y overflow-y-auto rounded-lg border bg-card shadow-sm">
                    {options.map((o) => (
                      <button key={o.id} onClick={() => addLine(o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm active:bg-accent/40">
                        <Boxes className="h-4 w-4 text-orange-600" />
                        <span className="flex-1">{o.name}</span>
                        {o.unit && <span className="text-[11px] text-muted-foreground">{o.unit}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {lines.length > 0 && (
                <div className="divide-y overflow-hidden rounded-lg border">
                  {lines.map((l) => (
                    <div key={l.productId} className="flex items-center gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                      <input
                        type="number" min={1} value={l.quantity}
                        onChange={(e) => setLines((ls) => ls.map((x) => x.productId === l.productId ? { ...x, quantity: Number(e.target.value) } : x))}
                        className="w-16 rounded-md border bg-background px-2 py-1 text-sm"
                      />
                      {l.unit && <span className="text-[11px] text-muted-foreground">{l.unit}</span>}
                      <button onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))} className="text-muted-foreground active:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {PRIORITIES.map((p) => (
                    <button key={p} onClick={() => setPriority(p)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${priority === p ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>{p}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Expected date</label>
                <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Reason</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Why is this needed?" />
              </div>

              <button onClick={submit} disabled={!canSubmit} className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Submitting…' : 'Raise Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
