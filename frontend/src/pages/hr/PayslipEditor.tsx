import { BaseInput } from '@/components/ui/input';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Save, Trash2, X, PlayCircle } from 'lucide-react';
import { payrollApi, PayslipEditView, PayslipLineItem } from '@/api/payrollApi';
import type { SalaryRecord } from '@/types/payroll';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const inr = (n?: number | null) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const num = (v: any) => (v == null || v === '' ? 0 : Number(v));

type Field = { key: string; label: string };
const DETAIL_FIELDS: Field[] = [
  { key: 'workedHours', label: 'Worked hours' }, { key: 'overtimeHours', label: 'Overtime hours' },
  { key: 'attendanceDays', label: 'Attendance days' }, { key: 'paidDays', label: 'Paid days' },
  { key: 'lopDays', label: 'LOP days' },
];
const EARNING_FIELDS: Field[] = [
  { key: 'regularEarnings', label: 'Salary / hours pay' }, { key: 'overtimeAmount', label: 'Overtime pay' },
  { key: 'basic', label: 'Basic' }, { key: 'hra', label: 'HRA' }, { key: 'allowances', label: 'Allowances' },
  { key: 'projectBonus', label: 'Project bonus' }, { key: 'manualBonus', label: 'Bonus' },
  { key: 'incentive', label: 'Incentive' }, { key: 'otherEarnings', label: 'Other earnings' },
];
const DEDUCTION_FIELDS: Field[] = [
  { key: 'pfAmount', label: 'PF' }, { key: 'esiAmount', label: 'ESI' }, { key: 'professionalTax', label: 'Professional tax' },
  { key: 'leaveDeduction', label: 'Leave (LOP)' }, { key: 'manualDeduction', label: 'Manual deduction' },
  { key: 'otherDeductionsExtra', label: 'Other deductions' },
];

/** The record's editable values as form strings. */
function toForm(r: SalaryRecord): Record<string, string> {
  const a = r as any;
  const split = num(a.projectBonus) + num(a.manualBonus);
  const f: Record<string, string> = {};
  [...DETAIL_FIELDS, ...EARNING_FIELDS, ...DEDUCTION_FIELDS].forEach(({ key }) => { f[key] = a[key] == null ? '' : String(a[key]); });
  if (split === 0 && num(a.bonus) > 0) f.manualBonus = String(a.bonus); // older payslips: one combined bonus
  f.otherDeductionsExtra = String(Math.max(0, num(a.otherDeductions) - num(a.manualDeduction)));
  f.remarks = a.remarks ?? '';
  return f;
}

/**
 * The full payslip editor HR opens after generating (or from the payslip list). Every amount on the
 * payslip can be changed — earnings, deductions, hours and days — plus named extra lines and a note for
 * the employee. Totals preview live and recompute on the server when saved. Regenerate rebuilds the
 * payslip from current attendance / bonuses / leads (dropping edits); Delete removes it and releases
 * everything it used. Locked once the payslip is PAID.
 */
export default function PayslipEditor({
  employeeId, name, month, year, onClose, onChanged,
}: {
  employeeId: number;
  name?: string;
  month: number;
  year: number;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [view, setView] = useState<PayslipEditView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [draft, setDraft] = useState({ category: 'EARNING' as 'EARNING' | 'DEDUCTION', label: '', amount: '' });

  const load = () => {
    setLoading(true);
    payrollApi.editablePayslip(employeeId, month, year)
      .then((v) => { setView(v); if (v.record) setForm(toForm(v.record)); setDirty(false); })
      .catch(() => setView(null)).finally(() => setLoading(false));
  };
  useEffect(load, [employeeId, month, year]);

  const rec = view?.record ?? null;
  const paid = rec?.status === 'PAID';
  const locked = paid || busy;
  const items = view?.lineItems ?? [];
  const presets = draft.category === 'EARNING' ? (view?.earningPresets ?? []) : (view?.deductionPresets ?? []);
  const earnItems = useMemo(() => items.filter((i) => i.category === 'EARNING'), [items]);
  const dedItems = useMemo(() => items.filter((i) => i.category === 'DEDUCTION'), [items]);

  // Live totals from the form + extra lines (the server recomputes the same way on save).
  const totals = useMemo(() => {
    const itemSum = (xs: PayslipLineItem[]) => xs.reduce((a, i) => a + num(i.amount), 0);
    const gross = EARNING_FIELDS.reduce((a, f) => a + num(form[f.key]), 0) + itemSum(earnItems);
    const ded = DEDUCTION_FIELDS.reduce((a, f) => a + num(form[f.key]), 0)
      + num(rec?.advanceRecovery) + num(rec?.loanRecovery) + itemSum(dedItems);
    return { gross, ded, net: gross - ded };
  }, [form, earnItems, dedItems, rec]);

  const set = (key: string, value: string) => { setForm((f) => ({ ...f, [key]: value })); setDirty(true); };

  const run = async <T,>(fn: () => Promise<T>, done?: (v: T) => void) => {
    setBusy(true);
    try { const v = await fn(); done?.(v); onChanged?.(); return true; }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Something went wrong'); return false; }
    finally { setBusy(false); }
  };
  // Line-item changes return the fresh view; keep unsaved field edits in the form.
  const applyItems = (fn: () => Promise<PayslipEditView>) => run(fn, (v) => setView(v));

  const save = () => {
    if (!rec?.id) return;
    const body: Record<string, number | string | null> = {};
    [...DETAIL_FIELDS, ...EARNING_FIELDS, ...DEDUCTION_FIELDS].forEach(({ key }) => { body[key] = form[key] === '' ? 0 : Number(form[key]); });
    if (Object.values(body).some((v) => typeof v === 'number' && (isNaN(v) || v < 0))) {
      toast.error('Amounts must be zero or more.');
      return;
    }
    body.remarks = form.remarks?.trim() || null;
    run(() => payrollApi.updatePayslipComponents(rec.id!, body), (v) => {
      setView(v); if (v.record) setForm(toForm(v.record)); setDirty(false);
      toast.success('Payslip saved');
    });
  };

  const regenerate = (basis?: 'HOURLY' | 'MONTHLY') => {
    if (!rec?.id) return;
    setRegenOpen(false);
    run(() => payrollApi.regeneratePayslip(rec.id!, basis), () => { toast.success('Payslip generated again'); load(); });
  };

  const remove = () => {
    if (!rec?.id) return;
    if (!confirm(`Delete this payslip for ${name || 'this employee'} (${MONTHS[month]} ${year})?\n\nBonuses, deductions, requests, advance/loan recoveries and leads it used are released, so you can generate it again.`)) return;
    run(() => payrollApi.deletePayslip(rec.id!), () => { toast.success('Payslip deleted'); onClose(); });
  };

  const generateNow = () => run(() => payrollApi.generatePayslip(employeeId, month, year), () => { toast.success('Payslip generated'); load(); });

  const addItem = () => {
    const amt = Number(draft.amount);
    if (!draft.label.trim()) return toast.error('Enter a label.');
    if (!amt || amt <= 0) return toast.error('Enter an amount.');
    applyItems(() => payrollApi.addPayslipLineItem(rec!.id!, { category: draft.category, label: draft.label.trim(), amount: amt }))
      .then((ok) => { if (ok) setDraft({ category: draft.category, label: '', amount: '' }); });
  };

  const close = () => {
    if (dirty && !confirm('You have unsaved changes. Close without saving?')) return;
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <span>Payslip — {name || `Employee #${employeeId}`} · {MONTHS[month]} {year}</span>
            {rec && <StatusTag status={rec.status} />}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
        ) : !rec ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">No payslip for {MONTHS[month]} {year} yet.</p>
            <Button onClick={generateNow} disabled={busy}><PlayCircle className="mr-1.5 h-4 w-4" /> Generate payslip</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {paid ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">This payslip is already paid, so it can't be changed or deleted.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
                <p className="mr-auto px-1 text-xs text-muted-foreground">
                  {rec.status === 'APPROVED' ? 'Approved — the employee can see it. Changes show for them straight away.' : 'Not approved yet — the employee can’t see it.'}
                </p>
                <div className="relative">
                  <Button size="sm" variant="outline" onClick={() => setRegenOpen((o) => !o)} disabled={busy}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate
                  </Button>
                  {regenOpen && (
                    <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border bg-card p-2 text-sm shadow-lg">
                      <p className="mb-2 px-1 text-xs text-muted-foreground">Builds it again from current attendance, bonuses, deductions and leads. Your edits here are dropped.</p>
                      <button className="w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => regenerate()}>Same basis ({rec.payType === 'HOURLY' ? 'Hourly' : 'Monthly'})</button>
                      <button className="w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => regenerate('HOURLY')}>As Hourly</button>
                      <button className="w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => regenerate('MONTHLY')}>As Monthly</button>
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={remove} disabled={busy}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            )}

            <Section title="Hours & days">
              <FieldGrid fields={DETAIL_FIELDS} form={form} onChange={set} disabled={locked} plain />
            </Section>

            <Section title="Earnings">
              <FieldGrid fields={EARNING_FIELDS} form={form} onChange={set} disabled={locked} />
              <ItemGroup items={earnItems} disabled={locked}
                onEdit={(it, v) => applyItems(() => payrollApi.updatePayslipLineItem(it.id, { amount: Number(v) }))}
                onDelete={(it) => applyItems(() => payrollApi.deletePayslipLineItem(it.id))} />
            </Section>

            <Section title="Deductions">
              <FieldGrid fields={DEDUCTION_FIELDS} form={form} onChange={set} disabled={locked} />
              {(num(rec.advanceRecovery) > 0 || num(rec.loanRecovery) > 0) && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <ReadOnly label="Advance recovery" value={num(rec.advanceRecovery)} />
                  <ReadOnly label="Loan recovery" value={num(rec.loanRecovery)} />
                  <p className="col-span-2 text-[11px] text-muted-foreground">Recovery moves the advance / loan balance, so change the plan and use Regenerate instead.</p>
                </div>
              )}
              <ItemGroup items={dedItems} negative disabled={locked}
                onEdit={(it, v) => applyItems(() => payrollApi.updatePayslipLineItem(it.id, { amount: Number(v) }))}
                onDelete={(it) => applyItems(() => payrollApi.deletePayslipLineItem(it.id))} />
            </Section>

            {!paid && (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Add a line</p>
                <div className="mb-2 flex gap-1">
                  {(['EARNING', 'DEDUCTION'] as const).map((c) => (
                    <button key={c} onClick={() => setDraft((d) => ({ ...d, category: c, label: '' }))}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${draft.category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {c === 'EARNING' ? 'Earning' : 'Deduction'}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <BaseInput list="payslip-presets" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                    placeholder="Label (e.g. Travel allowance)" className="h-9 min-w-[200px] flex-1 rounded-md border px-3 text-sm" />
                  <datalist id="payslip-presets">{presets.map((p) => <option key={p} value={p} />)}</datalist>
                  <BaseInput type="number" min={0} value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                    placeholder="Amount" className="h-9 w-28 rounded-md border px-3 text-sm" />
                  <Button size="sm" onClick={addItem} disabled={busy}><Plus className="h-4 w-4" /> Add</Button>
                </div>
              </div>
            )}

            <Section title="Note for the employee">
              <textarea value={form.remarks ?? ''} onChange={(e) => set('remarks', e.target.value)} disabled={locked} rows={2}
                placeholder="Shown on the payslip, e.g. Includes Diwali allowance"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60" />
            </Section>

            <div className="sticky bottom-0 -mx-1 rounded-lg border-2 border-primary/20 bg-card p-3 shadow-sm">
              <Row label="Gross earnings" value={totals.gross} bold />
              <Row label="Total deductions" value={-totals.ded} />
              <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-bold">
                <span>Net pay</span><span className="tabular-nums">{inr(totals.net)}</span>
              </div>
              {!paid && (
                <div className="mt-3 flex items-center justify-end gap-2">
                  {dirty && <span className="mr-auto text-xs text-amber-700">Unsaved changes</span>}
                  <Button variant="outline" size="sm" onClick={close}><X className="h-4 w-4" /> Close</Button>
                  <Button size="sm" onClick={save} disabled={busy || !dirty}>
                    {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save payslip
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {(paid || !rec) && !loading && (
          <div className="mt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={onClose}><X className="h-4 w-4" /> Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusTag({ status }: { status?: string }) {
  const tone = status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : status === 'APPROVED' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800';
  const label = status === 'PENDING' ? 'To approve' : status === 'APPROVED' ? 'Approved' : status === 'PAID' ? 'Paid' : status;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function FieldGrid({ fields, form, onChange, disabled, plain }: {
  fields: Field[]; form: Record<string, string>; onChange: (k: string, v: string) => void; disabled?: boolean; plain?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-[11px] text-muted-foreground">{f.label}</span>
          <div className="relative mt-0.5">
            {!plain && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>}
            <BaseInput type="number" min={0} step="any" inputMode="decimal" value={form[f.key] ?? ''} disabled={disabled}
              onChange={(e) => onChange(f.key, e.target.value)}
              className={`h-9 w-full rounded-md border pr-2 text-right text-sm tabular-nums disabled:opacity-60 ${plain ? 'pl-2' : 'pl-6'}`} />
          </div>
        </label>
      ))}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2.5 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-right text-sm tabular-nums">{inr(value)}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${value < 0 ? 'text-red-600' : ''}`}>{value < 0 ? '−' : ''}{inr(Math.abs(value))}</span>
    </div>
  );
}

function ItemGroup({ items, negative, onEdit, onDelete, disabled }: {
  items: PayslipLineItem[]; negative?: boolean;
  onEdit: (it: PayslipLineItem, v: string) => void; onDelete: (it: PayslipLineItem) => void; disabled?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
          <span className="min-w-0 flex-1 truncate" title={it.label}>{it.label}</span>
          <span className={negative ? 'text-red-600' : ''}>{negative ? '−' : ''}₹</span>
          <BaseInput key={`${it.id}-${it.amount}`} type="number" min={0} defaultValue={it.amount} disabled={disabled}
            onBlur={(e) => { if (Number(e.target.value) !== Number(it.amount)) onEdit(it, e.target.value); }}
            className="h-8 w-24 rounded border px-2 text-right text-sm tabular-nums disabled:opacity-60" />
          <button onClick={() => onDelete(it)} disabled={disabled} className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-40" title="Remove line" aria-label={`Remove ${it.label}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
