import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X, Camera, Video, Trash2, CalendarDays } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { DailyReportEntry, DailyReportCreateBody, MyProject } from '@/types/employeePortal';
import { uploadFile } from '@/lib/uploadFile';
import { PortalHeader, StatusPill, EmptyState } from './_shared';

interface Media { mediaType: string; fileUrl: string }
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): DailyReportCreateBody => ({
  projectId: null, reportDate: today(), todaysWork: '', hoursWorked: '', completedWork: '',
  pendingWork: '', problems: '', materialUsed: '', materialRequired: '', remarks: '',
});

export default function DailyReports() {
  const [list, setList] = useState<DailyReportEntry[]>([]);
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<DailyReportCreateBody>(emptyForm());
  const [media, setMedia] = useState<Media[]>([]);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    employeePortalApi.dailyReports().then(setList).catch(() => {});
    employeePortalApi.projects().then(setProjects).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof DailyReportCreateBody>(k: K, v: DailyReportCreateBody[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'PHOTO' | 'VIDEO') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { fileUrl } = await uploadFile(file, 'DAILY_REPORT');
      setMedia((m) => [...m, { mediaType, fileUrl }]);
    } catch {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError('');
    if (!form.todaysWork?.trim() && !form.completedWork?.trim()) { setError('Describe today’s work.'); return; }
    setSaving(true);
    try {
      const body: DailyReportCreateBody = {
        ...Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '' && v != null)),
        media,
      } as DailyReportCreateBody;
      await employeePortalApi.createDailyReport(body);
      setOpen(false);
      setForm(emptyForm());
      setMedia([]);
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not submit the report.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <PortalHeader
        title="Daily Reports"
        action={
          <button onClick={() => { setForm(emptyForm()); setMedia([]); setError(''); setOpen(true); }} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
            <Plus className="h-4 w-4" /> New
          </button>
        }
      />

      <div className="mx-3 my-3 flex flex-col gap-2">
        {list.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm"><EmptyState message="No daily reports yet." /></div>
        ) : (
          list.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-sky-600" /> {r.reportDate}
                  {r.hoursWorked != null && <span className="text-xs font-normal text-muted-foreground">· {r.hoursWorked}h</span>}
                </p>
                <StatusPill status={r.status} />
              </div>
              {r.project?.projectName && <p className="mt-0.5 text-[11px] text-muted-foreground">{r.project.projectName}</p>}
              {r.todaysWork && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.todaysWork}</p>}
              {r.media?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.media.map((m, i) => (
                    <span key={i} className="rounded-md bg-accent/60 px-2 py-0.5 text-[10px] text-muted-foreground">{m.mediaType}</span>
                  ))}
                </div>
              )}
              {r.managerComment && <p className="mt-2 rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-800">Manager: {r.managerComment}</p>}
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-md mx-auto overflow-y-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Daily Report</h2>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <input type="date" value={form.reportDate} onChange={(e) => set('reportDate', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Hours worked</label>
                  <input type="number" min={0} step="0.5" value={form.hoursWorked as string} onChange={(e) => set('hoursWorked', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <select value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="">— Select project (optional) —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                </select>
              </div>
              <Area label="Today's work" value={form.todaysWork} onChange={(v) => set('todaysWork', v)} placeholder="What did you work on today?" />
              <Area label="Completed work" value={form.completedWork} onChange={(v) => set('completedWork', v)} />
              <Area label="Pending work" value={form.pendingWork} onChange={(v) => set('pendingWork', v)} />
              <Area label="Problems / blockers" value={form.problems} onChange={(v) => set('problems', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Area label="Material used" value={form.materialUsed} onChange={(v) => set('materialUsed', v)} rows={2} />
                <Area label="Material required" value={form.materialRequired} onChange={(v) => set('materialRequired', v)} rows={2} />
              </div>

              {/* Media */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Photos / Videos</label>
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card py-2 text-xs font-medium disabled:opacity-60">
                    <Camera className="h-4 w-4" /> Photo
                  </button>
                  <button type="button" onClick={() => videoInput.current?.click()} disabled={uploading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card py-2 text-xs font-medium disabled:opacity-60">
                    <Video className="h-4 w-4" /> Video
                  </button>
                </div>
                <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e, 'PHOTO')} />
                <input ref={videoInput} type="file" accept="video/*" capture className="hidden" onChange={(e) => onFile(e, 'VIDEO')} />
                {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
                {media.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {media.map((m, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px]">
                        {m.mediaType}
                        <button type="button" onClick={() => setMedia((mm) => mm.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Area label="Remarks" value={form.remarks} onChange={(v) => set('remarks', v)} rows={2} />

              <button onClick={submit} disabled={saving || uploading} className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Area({ label, value, onChange, placeholder, rows = 2 }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
    </div>
  );
}
