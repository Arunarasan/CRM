import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { payrollApi, PayslipEditView, PayslipLineItem } from '@/api/payrollApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const inr = (n?: number | null) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const num = (v: any) => (v == null ? 0 : Number(v));

/**
 * Editable payslip: add/edit/remove named earnings (lead/project task-completion incentive,
 * customer-feedback incentive, company incentive, allowance, bonus) and deductions on top of the
 * auto-computed payslip. Totals recompute server-side on each change; the employee sees the result
 * in their portal. Locked once the payslip is PAID.
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
  const [draft, setDraft] = useState({ category: 'EARNING' as 'EARNING' | 'DEDUCTION', label: '', amount: '' });

  useEffect(() => {
    setLoading(true);
    payrollApi.editablePayslip(employeeId, month, year)
      .then(setView).catch(() => setView(null)).finally(() => setLoading(false));
  }, [employeeId, month, year]);

  const rec = view?.record ?? null;
  const paid = rec?.status === 'PAID';
  const items = view?.lineItems ?? [];
  const presets = draft.category === 'EARNING' ? (view?.earningPresets ?? []) : (view?.deductionPresets ?? []);

  const earnItems = useMemo(() => items.filter((i) => i.category === 'EARNING'), [items]);
  const dedItems = useMemo(() => items.filter((i) => i.category === 'DEDUCTION'), [items]);

  const apply = async (fn: () => Promise<PayslipEditView>) => {
    setBusy(true);
    try { const v = await fn(); setView(v); onChanged?.(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const addItem = () => {
    const amt = Number(draft.amount);
    if (!draft.label.trim()) return toast.error('Enter a label.');
    if (!amt || amt <= 0) return toast.error('Enter an amount.');
    apply(() => payrollApi.addPayslipLineItem(rec!.id!, { category: draft.category, label: draft.label.trim(), amount: amt }))
      .then(() => setDraft({ category: draft.category, label: '', amount: '' }));
  };

  const editAmount = (it: PayslipLineItem, value: string) => {
    const amt = Number(value);
    if (isNaN(amt)) return;
    apply(() => payrollApi.updatePayslipLineItem(it.id, { amount: amt }));
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit payslip — {name || `Employee #${employeeId}`} · {MONTHS[month]} {year}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
        ) : !rec ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No payslip generated for {MONTHS[month]} {year} yet. Run payroll for this employee first, then edit here.
          </p>
        ) : (
          <div className="space-y-4">
            {paid && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">This payslip is already paid and can't be edited.</p>}

            {/* Auto-computed base (read-only) */}
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <Row label="Earnings from attendance" value={num(rec.regularEarnings) + num(rec.overtimeAmount) + num(rec.basic)} />
              {num(rec.bonus) > 0 && <Row label="Auto bonus" value={num(rec.bonus)} />}
              {num(rec.incentive) > 0 && <Row label="Auto incentive" value={num(rec.incentive)} />}
              {(num(rec.advanceRecovery) + num(rec.loanRecovery)) > 0 &&
                <Row label="Advance / loan recovery" value={-(num(rec.advanceRecovery) + num(rec.loanRecovery))} />}
              {(num(rec.pfAmount) + num(rec.esiAmount) + num(rec.professionalTax)) > 0 &&
                <Row label="PF / ESI / PT" value={-(num(rec.pfAmount) + num(rec.esiAmount) + num(rec.professionalTax))} />}
            </div>

            {/* Editable line items */}
            <ItemGroup title="Added earnings" items={earnItems} onEdit={editAmount} onDelete={(it) => apply(() => payrollApi.deletePayslipLineItem(it.id))} disabled={paid || busy} />
            <ItemGroup title="Added deductions" items={dedItems} negative onEdit={editAmount} onDelete={(it) => apply(() => payrollApi.deletePayslipLineItem(it.id))} disabled={paid || busy} />

            {/* Add form */}
            {!paid && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex gap-1">
                  {(['EARNING', 'DEDUCTION'] as const).map((c) => (
                    <button key={c} onClick={() => setDraft((d) => ({ ...d, category: c, label: '' }))}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${draft.category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {c === 'EARNING' ? 'Earning' : 'Deduction'}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input list="payslip-presets" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                    placeholder="Label (e.g. Customer feedback incentive)" className="h-9 min-w-[200px] flex-1 rounded-md border px-3 text-sm" />
                  <datalist id="payslip-presets">{presets.map((p) => <option key={p} value={p} />)}</datalist>
                  <input type="number" min={0} value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                    placeholder="Amount" className="h-9 w-28 rounded-md border px-3 text-sm" />
                  <Button size="sm" onClick={addItem} disabled={busy}><Plus className="h-4 w-4" /> Add</Button>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-3">
              <Row label="Gross earnings" value={num(rec.grossEarnings)} bold />
              <Row label="Total deductions" value={-num(rec.totalDeductions)} />
              <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-bold">
                <span>Net pay</span><span className="tabular-nums">{inr(rec.netSalary)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}><X className="h-4 w-4" /> Close</Button>
        </div>
      </DialogContent>
    </Dialog>
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

function ItemGroup({ title, items, negative, onEdit, onDelete, disabled }: {
  title: string; items: PayslipLineItem[]; negative?: boolean;
  onEdit: (it: PayslipLineItem, v: string) => void; onDelete: (it: PayslipLineItem) => void; disabled?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="space-y-1">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            <span className={negative ? 'text-red-600' : ''}>{negative ? '−' : ''}₹</span>
            <input type="number" min={0} defaultValue={it.amount} disabled={disabled}
              onBlur={(e) => { if (Number(e.target.value) !== it.amount) onEdit(it, e.target.value); }}
              className="h-8 w-24 rounded border px-2 text-right text-sm tabular-nums disabled:opacity-60" />
            <button onClick={() => onDelete(it)} disabled={disabled} className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-40" title="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
