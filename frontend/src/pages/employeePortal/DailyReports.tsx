import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X, Camera, Video, Trash2, CalendarDays } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { DailyReportEntry, DailyReportCreateBody, MyProject, LeadSummary } from '@/types/employeePortal';
import { uploadFile } from '@/lib/uploadFile';
import { PortalHeader, StatusPill, EmptyState } from './_shared';
import { useT, useTr } from '@/i18n';

interface Media { mediaType: string; fileUrl: string }
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): DailyReportCreateBody => ({
  projectId: null, leadId: null, reportDate: today(), todaysWork: '', hoursWorked: '', completedWork: '',
  pendingWork: '', problems: '', materialUsed: '', materialRequired: '', remarks: '',
  cashCollected: '', cashPaymentMethod: 'CASH', cashReference: '',
});

export default function DailyReports() {
  const { t } = useT();
  const tr = useTr();
  const [list, setList] = useState<DailyReportEntry[]>([]);
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
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
    employeePortalApi.leads().then(setLeads).catch(() => {});
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
      setError(t('pw.dr.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError('');
    if (!form.todaysWork?.trim() && !form.completedWork?.trim()) { setError(t('pw.dr.describe')); return; }
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
      setError(e?.message || t('pw.dr.submitFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <PortalHeader
        title={t('pw.dr.title')}
        action={
          <button onClick={() => { setForm(emptyForm()); setMedia([]); setError(''); setOpen(true); }} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
            <Plus className="h-4 w-4" /> {t('pw.new')}
          </button>
        }
      />

      <div className="mx-3 my-3 grid grid-cols-1 gap-2 md:grid-cols-2 md:items-start [&>*]:min-w-0 md:[&>*:only-child]:col-span-2">
        {list.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm"><EmptyState message={t('pw.dr.none')} /></div>
        ) : (
          list.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-emerald-600" /> {r.reportDate}
                  {r.hoursWorked != null && <span className="text-xs font-normal text-muted-foreground">· {r.hoursWorked}h</span>}
                </p>
                <StatusPill status={r.status} />
              </div>
              {r.project?.projectName && <p className="mt-0.5 text-[11px] text-muted-foreground">{r.project.projectName}</p>}
              {r.todaysWork && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.todaysWork}</p>}
              {r.media?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.media.map((m, i) => (
                    <span key={i} className="rounded-md bg-accent/60 px-2 py-0.5 text-[10px] text-muted-foreground">{tr(`pw.dr.${m.mediaType}`, m.mediaType)}</span>
                  ))}
                </div>
              )}
              {r.managerComment && <p className="mt-2 rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-800">{t('pw.dr.manager', { text: r.managerComment })}</p>}
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[92dvh] w-full max-w-md mx-auto sm:max-w-lg overflow-y-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('pw.dr.formTitle')}</h2>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t('pw.date')}</label>
                  <BaseInput type="date" value={form.reportDate} onChange={(e) => set('reportDate', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t('pw.dr.hours')}</label>
                  <BaseInput type="number" min={0} step="0.5" value={form.hoursWorked as string} onChange={(e) => set('hoursWorked', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('pw.project')}</label>
                <select value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="">{t('pw.selectProject')}</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('pw.dr.lead')}</label>
                <select value={form.leadId ?? ''} onChange={(e) => set('leadId', e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="">{t('pw.dr.linkLead')}</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.name}{l.leadNumber ? ` (${l.leadNumber})` : ''}</option>)}
                </select>
              </div>
              <Area label={t('pw.dr.todaysWork')} value={form.todaysWork} onChange={(v) => set('todaysWork', v)} placeholder={t('pw.dr.todaysWorkPh')} />
              <Area label={t('pw.dr.completed')} value={form.completedWork} onChange={(v) => set('completedWork', v)} />
              <Area label={t('pw.dr.pending')} value={form.pendingWork} onChange={(v) => set('pendingWork', v)} />
              <Area label={t('pw.dr.problems')} value={form.problems} onChange={(v) => set('problems', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Area label={t('pw.dr.materialUsed')} value={form.materialUsed} onChange={(v) => set('materialUsed', v)} rows={2} />
                <Area label={t('pw.dr.materialRequired')} value={form.materialRequired} onChange={(v) => set('materialRequired', v)} rows={2} />
              </div>

              {/* Media */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('pw.dr.photosVideos')}</label>
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card py-2 text-xs font-medium disabled:opacity-60">
                    <Camera className="h-4 w-4" /> {t('pw.dr.photo')}
                  </button>
                  <button type="button" onClick={() => videoInput.current?.click()} disabled={uploading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card py-2 text-xs font-medium disabled:opacity-60">
                    <Video className="h-4 w-4" /> {t('pw.dr.video')}
                  </button>
                </div>
                <BaseInput ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e, 'PHOTO')} />
                <BaseInput ref={videoInput} type="file" accept="video/*" capture className="hidden" onChange={(e) => onFile(e, 'VIDEO')} />
                {uploading && <p className="mt-1 text-xs text-muted-foreground">{t('pw.dr.uploading')}</p>}
                {media.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {media.map((m, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px]">
                        {tr(`pw.dr.${m.mediaType}`, m.mediaType)}
                        <button type="button" onClick={() => setMedia((mm) => mm.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Cash collected from the customer — raises a payment for finance to approve.
                  Needs a project (that's where the customer + money go). */}
              {form.projectId ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="text-xs font-semibold text-emerald-800 mb-2">{t('pw.dr.cashTitle')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">{t('pw.dr.cashAmount')}</label>
                      <BaseInput type="number" min={0} step="1" value={form.cashCollected as string}
                        onChange={(e) => set('cashCollected', e.target.value)}
                        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">{t('pw.dr.cashMethod')}</label>
                      <select value={form.cashPaymentMethod ?? 'CASH'} onChange={(e) => set('cashPaymentMethod', e.target.value)}
                        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                        {['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'NEFT'].map((m) => <option key={m} value={m}>{t(`pw.dr.method.${m}`)}</option>)}
                      </select>
                    </div>
                  </div>
                  <BaseInput value={form.cashReference ?? ''} onChange={(e) => set('cashReference', e.target.value)}
                    className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t('pw.dr.cashRef')} />
                  <p className="mt-1.5 text-[11px] text-emerald-700/80">{t('pw.dr.cashNote')}</p>
                </div>
              ) : null}

              <Area label={t('pw.dr.remarks')} value={form.remarks} onChange={(v) => set('remarks', v)} rows={2} />

              <button onClick={submit} disabled={saving || uploading} className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? t('pw.submitting') : t('pw.dr.submit')}
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
