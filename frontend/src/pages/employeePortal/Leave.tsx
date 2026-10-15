import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { LeaveRequestEntry, LeaveBalance } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState } from './_shared';
import { useT } from '@/i18n';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED', 'MATERNITY'];

type When = 'TODAY' | 'TOMORROW' | 'CUSTOM';
/** yyyy-mm-dd in the device's local day (toISOString would shift it to UTC). */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const emptyForm = () => ({ type: 'CASUAL', startDate: dayOffset(0), endDate: dayOffset(0), reason: '' });

export default function Leave() {
  const { t } = useT();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequestEntry[]>([]);
  const [params] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [when, setWhen] = useState<When>('TODAY');
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    employeePortalApi.leaveBalance().then(setBalance).catch(() => {});
    employeePortalApi.leaves().then(setLeaves).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const choose = (w: When) => {
    setWhen(w);
    if (w === 'TODAY') setForm((f) => ({ ...f, startDate: dayOffset(0), endDate: dayOffset(0) }));
    if (w === 'TOMORROW') setForm((f) => ({ ...f, startDate: dayOffset(1), endDate: dayOffset(1) }));
  };
  const dayCount = form.startDate && form.endDate && form.endDate >= form.startDate
    ? Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1 : 0;

  const submit = async () => {
    setError('');
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) { setError(t('pw.leave.pickDates')); return; }
    setSaving(true);
    try {
      await employeePortalApi.applyLeave(form);
      setOpen(false);
      setForm(emptyForm());
      setWhen('TODAY');
      load();
    } catch (e: any) {
      setError(e?.message || t('pw.leave.submitFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <PortalHeader
        title={t('pw.leave.title')}
        action={
          <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
            <Plus className="h-4 w-4" /> {t('pw.leave.apply')}
          </button>
        }
      />

      <div className="mx-3 my-3 grid grid-cols-3 gap-2">
        {[
          { label: t('pw.leave.allowance'), value: balance?.annualAllowance },
          { label: t('pw.leave.taken'), value: balance?.taken },
          { label: t('pw.leave.remaining'), value: balance?.remaining },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3 text-center shadow-sm">
            <p className="text-2xl font-bold leading-none">{s.value ?? '–'}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <h3 className="px-4 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">{t('pw.leave.requests')}</h3>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {leaves.length === 0 ? (
          <EmptyState message={t('pw.leave.none')} />
        ) : (
          leaves.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t(`pw.leave.${l.type}`) === `pw.leave.${l.type}` ? l.type : t(`pw.leave.${l.type}`)} · {l.startDate} → {l.endDate}</p>
                {l.reason && <p className="truncate text-xs text-muted-foreground">{l.reason}</p>}
              </div>
              <StatusPill status={l.status} />
            </div>
          ))
        )}
      </div>

      {/* Bottom-sheet apply form */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md mx-auto sm:max-w-lg rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('pw.leave.applyTitle')}</h2>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('pw.leave.type')}</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {LEAVE_TYPES.map((lt) => (
                    <button key={lt} onClick={() => setForm((f) => ({ ...f, type: lt }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.type === lt ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                      {t(`pw.leave.${lt}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('pw.leave.when')}</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(['TODAY', 'TOMORROW', 'CUSTOM'] as When[]).map((w) => (
                    <button key={w} onClick={() => choose(w)}
                      className={`h-11 rounded-xl border text-sm font-semibold active:scale-[0.98] ${when === w ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>
                      {t(`pw.leave.${w.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
                {when === 'CUSTOM' && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">{t('pw.from')}</label>
                      <BaseInput type="date" min={dayOffset(0)} value={form.startDate}
                        onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))}
                        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">{t('pw.to')}</label>
                      <BaseInput type="date" min={form.startDate || dayOffset(0)} value={form.endDate}
                        onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    </div>
                  </div>
                )}
                {dayCount > 0 && <p className="mt-2 text-xs text-muted-foreground">{t('pw.leave.daysCount', { count: dayCount })}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('pw.att.reason')}</label>
                <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t('pw.leave.reasonPh')} />
              </div>
              <button onClick={submit} disabled={saving} className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? t('pw.leave.submitting') : t('pw.leave.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
