import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Phone, MapPin } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { LeadSummary, LeadCreateBody } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState, inr } from './_shared';

const EMPTY: LeadCreateBody = {
  name: '', mobileNumber: '', email: '', address: '', city: '',
  requirementCategory: '', requirement: '', estimatedBudget: '', preferredVisitDate: '', notes: '',
};

const CATEGORIES = ['Full Home', 'Kitchen', 'Wardrobe', 'False Ceiling', 'Painting', 'Flooring', 'Other'];

export default function Leads() {
  const [list, setList] = useState<LeadSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<LeadCreateBody>(EMPTY);

  const load = useCallback(() => {
    employeePortalApi.leads().then(setList).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof LeadCreateBody>(k: K, v: LeadCreateBody[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (!form.name?.trim()) { setError('Customer name is required.'); return; }
    setSaving(true);
    try {
      // strip empty strings so the backend sees nulls, not blanks
      const body = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== '' && v != null),
      ) as unknown as LeadCreateBody;
      await employeePortalApi.createLead(body);
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not submit the lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <PortalHeader
        title="My Leads"
        action={
          <button onClick={() => { setForm(EMPTY); setError(''); setOpen(true); }} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
            <Plus className="h-4 w-4" /> Add
          </button>
        }
      />

      <div className="mx-3 my-3 flex flex-col gap-2">
        {list.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm"><EmptyState message="No leads yet. Add your first one." /></div>
        ) : (
          list.map((l) => (
            <div key={l.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{l.name}</p>
                  <p className="text-[11px] text-muted-foreground">{l.leadNumber}</p>
                </div>
                <StatusPill status={(l.status || 'NEW').toUpperCase()} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {l.mobileNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.mobileNumber}</span>}
                {l.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{l.city}</span>}
                {l.requirementCategory && <span>{l.requirementCategory}</span>}
                {l.estimatedBudget != null && <span className="font-medium text-foreground">{inr(l.estimatedBudget)}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-md mx-auto overflow-y-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Add Lead</h2>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

            <div className="flex flex-col gap-3">
              <Field label="Customer name *">
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Full name" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile">
                  <input value={form.mobileNumber} onChange={(e) => set('mobileNumber', e.target.value)} inputMode="tel" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="10-digit" />
                </Field>
                <Field label="City">
                  <input value={form.city} onChange={(e) => set('city', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Email">
                <input value={form.email} onChange={(e) => set('email', e.target.value)} inputMode="email" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Address / Location">
                <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Requirement type">
                <div className="mt-1 flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c} onClick={() => set('requirementCategory', c)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.requirementCategory === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>{c}</button>
                  ))}
                </div>
              </Field>
              <Field label="Requirement details">
                <textarea value={form.requirement} onChange={(e) => set('requirement', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="What does the customer want?" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estimated budget">
                  <input value={form.estimatedBudget as string} onChange={(e) => set('estimatedBudget', e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="₹" />
                </Field>
                <Field label="Preferred visit">
                  <input type="date" value={form.preferredVisitDate} onChange={(e) => set('preferredVisitDate', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Notes">
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </Field>

              <button onClick={submit} disabled={saving} className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Submitting…' : 'Submit Lead'}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">Your manager will review and assign this lead.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
