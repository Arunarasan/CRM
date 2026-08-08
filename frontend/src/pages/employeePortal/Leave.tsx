import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { LeaveRequestEntry, LeaveBalance } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState } from './_shared';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED', 'MATERNITY'];

export default function Leave() {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequestEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ type: 'CASUAL', startDate: '', endDate: '', reason: '' });

  const load = useCallback(() => {
    employeePortalApi.leaveBalance().then(setBalance).catch(() => {});
    employeePortalApi.leaves().then(setLeaves).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setError('');
    if (!form.startDate || !form.endDate) { setError('Pick start and end dates.'); return; }
    setSaving(true);
    try {
      await employeePortalApi.applyLeave(form);
      setOpen(false);
      setForm({ type: 'CASUAL', startDate: '', endDate: '', reason: '' });
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not submit leave.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <PortalHeader
        title="Leave"
        action={
          <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
            <Plus className="h-4 w-4" /> Apply
          </button>
        }
      />

      <div className="mx-3 my-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Allowance', value: balance?.annualAllowance },
          { label: 'Taken', value: balance?.taken },
          { label: 'Remaining', value: balance?.remaining },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3 text-center shadow-sm">
            <p className="text-2xl font-bold leading-none">{s.value ?? '–'}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <h3 className="px-4 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">Requests</h3>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {leaves.length === 0 ? (
          <EmptyState message="No leave requests yet." />
        ) : (
          leaves.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{l.type} · {l.startDate} → {l.endDate}</p>
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
          <div className="w-full max-w-md mx-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Apply for Leave</h2>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {LEAVE_TYPES.map((t) => (
                    <button key={t} onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.type === t ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">From</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">To</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reason</label>
                <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Optional" />
              </div>
              <button onClick={submit} disabled={saving} className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
