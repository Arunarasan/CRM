import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  TrendingUp, TrendingDown, RefreshCw, Loader2, Plus, Trash2, Receipt,
} from "lucide-react";
import { financeApi } from "@/api/financeApi";
import type { ProjectProfitability, ProjectExpense } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/toast";

const inr = (n?: number | null) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

// Friendly labels over the backend's EXPENSE_CATEGORIES. Travel/shipping live under TRANSPORT.
const EXPENSE_OPTIONS: { value: string; label: string }[] = [
  { value: "TRANSPORT", label: "Travel / Shipping" },
  { value: "MATERIAL", label: "Material / Product" },
  { value: "LABOUR", label: "Labour" },
  { value: "CONTRACTOR", label: "Contractor" },
  { value: "EQUIPMENT", label: "Equipment / Tools" },
  { value: "OVERHEAD", label: "Overhead" },
  { value: "MISC", label: "Other" },
];
const catLabel = (c: string) => EXPENSE_OPTIONS.find((o) => o.value === c)?.label ?? c;

/**
 * Per-project profit & margin, shown two ways side by side:
 *  · Cash basis — money the customer has actually paid vs money actually paid to
 *    contractors, product purchases and other expenses (travel, shipping…).
 *  · Accrual — invoiced revenue vs billed/synced cost (the existing profit card figures).
 * Also hosts a quick "Add expense" form that books a MANUAL project expense.
 */
export default function ProjectProfitPanel({ project, refreshSignal = 0 }: { project: any; refreshSignal?: number }) {
  const { hasAuthority } = useAuth();
  const canRead = hasAuthority("FINANCE_READ");
  const canWrite = hasAuthority("FINANCE_WRITE");
  const projectId = project?.id;

  const [prof, setProf] = useState<ProjectProfitability | null>(null);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    // getProjectProfitability re-syncs costs server-side, so it reflects the latest bills.
    Promise.all([
      financeApi.getProjectProfitability(projectId),
      financeApi.getExpenses(projectId, 0, 200),
    ])
      .then(([p, e]) => { setProf(p); setExpenses(e.content || []); })
      .catch((err) => { if (err?.response?.status !== 403) console.error(err); })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);
  // Refetch when the parent signals a billing/payment change.
  useEffect(() => { if (refreshSignal) load(); }, [refreshSignal, load]);

  const sync = async () => {
    setBusy(true);
    try { await financeApi.syncProjectExpenses(projectId); load(); }
    catch (e) { console.error(e); } finally { setBusy(false); }
  };

  if (!canRead) return null;
  if (loading && !prof) {
    return (
      <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
    );
  }
  if (!prof) return null;

  const manual = expenses.filter((e) => e.source === "MANUAL");

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <TrendingUp className="h-5 w-5 text-emerald-600" /> Profit &amp; Margin
        </h3>
        <Button size="sm" variant="outline" disabled={busy} onClick={sync}>
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Sync Costs
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cash basis — actual money in vs out */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Actual Money (cash basis)</div>
          <div className="space-y-1.5 text-sm">
            <Line label="Customer paid" value={inr(prof.customerPaid)} tone="text-emerald-700" />
            <div className="border-t border-slate-200 pt-1.5" />
            <Line label="Contractor paid" value={inr(prof.contractorPaid)} tone="text-rose-600" />
            <Line label="Product purchase" value={inr(prof.purchasePaid)} tone="text-rose-600" />
            <Line label="Other expenses" value={inr(prof.otherExpensesPaid)} tone="text-rose-600" />
            <Line label="Total paid out" value={inr(prof.cashOut)} tone="text-rose-700" bold />
          </div>
          <div className={`mt-3 flex items-center justify-between rounded-xl p-3 ${prof.cashProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
            <div className="flex items-center gap-2">
              {prof.cashProfit >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
              <span className="text-xs font-semibold uppercase text-slate-500">Cash Profit</span>
            </div>
            <div className="text-right">
              <div className={`text-lg font-black ${prof.cashProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{inr(prof.cashProfit)}</div>
              <div className={`text-xs font-bold ${prof.cashProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{prof.cashMarginPercent}% margin</div>
            </div>
          </div>
        </div>

        {/* Accrual — invoiced vs billed */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Invoiced vs Billed (accrual)</div>
          <div className="space-y-1.5 text-sm">
            <Line label="Revenue (invoiced)" value={inr(prof.revenue)} tone="text-emerald-700" />
            <Line label="Collected" value={inr(prof.collected)} tone="text-emerald-600" />
            <Line label="Outstanding" value={inr(prof.outstanding)} tone="text-amber-700" />
            <div className="border-t border-slate-200 pt-1.5" />
            <Line label="Material cost" value={inr(prof.materialCost)} tone="text-rose-600" />
            <Line label="Labour / contractor" value={inr(prof.labourCost)} tone="text-rose-600" />
            <Line label="Total cost" value={inr(prof.totalExpenses)} tone="text-rose-700" bold />
          </div>
          <div className={`mt-3 flex items-center justify-between rounded-xl p-3 ${prof.netProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
            <span className="text-xs font-semibold uppercase text-slate-500">Net Profit</span>
            <div className="text-right">
              <div className={`text-lg font-black ${prof.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{inr(prof.netProfit)}</div>
              <div className={`text-xs font-bold ${prof.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{prof.profitPercent}% margin</div>
            </div>
          </div>
        </div>
      </div>

      {/* Other expenses — travel, shipping, food, misc */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-bold text-slate-700">Other Expenses</h4>
          <span className="text-xs text-slate-400">travel, shipping, tools & misc — booked against this project</span>
        </div>

        {canWrite && <QuickAddExpense projectId={projectId} onAdded={load} />}

        <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
          {manual.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No manual expenses yet.</p>
          ) : (
            manual.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-slate-700">{e.description || catLabel(e.category)}</div>
                  <div className="text-xs text-slate-400">
                    {catLabel(e.category)} · {e.expenseDate ? format(new Date(e.expenseDate), "dd MMM yyyy") : ""}
                    {e.vendor ? ` · ${e.vendor}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-rose-600">{inr(e.amount)}</span>
                  {canWrite && (
                    <button type="button" title="Delete expense"
                      className="text-slate-300 hover:text-red-500"
                      onClick={() => {
                        if (!confirm("Delete this expense?")) return;
                        financeApi.deleteExpense(e.id).then(load)
                          .catch((err) => toast.error(err?.response?.data?.message || "Could not delete"));
                      }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function Line({ label, value, tone = "", bold }: { label: string; value: string; tone?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-slate-500 ${bold ? "font-semibold" : ""}`}>{label}</span>
      <span className={`${bold ? "font-black" : "font-semibold"} ${tone}`}>{value}</span>
    </div>
  );
}

/** Inline row to book a MANUAL project expense (category + amount + date + note). */
function QuickAddExpense({ projectId, onAdded }: { projectId: number; onAdded: () => void }) {
  const [category, setCategory] = useState("TRANSPORT");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    setSaving(true);
    try {
      await financeApi.addExpense({
        project: { id: projectId },
        category,
        amount: amt,
        expenseDate: date,
        description: description.trim() || undefined,
      });
      setAmount(""); setDescription("");
      toast.success("Expense added");
      onAdded();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not add expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-12">
      <select value={category} onChange={(e) => setCategory(e.target.value)}
        className="col-span-2 rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:col-span-3">
        {EXPENSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div className="relative col-span-1 sm:col-span-2">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
        <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="0" className="pl-5 text-right" />
      </div>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="col-span-1 sm:col-span-3" />
      <Input value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Note (e.g. auto fare)" className="col-span-2 sm:col-span-3" />
      <Button size="sm" onClick={add} disabled={saving} className="col-span-2 sm:col-span-1">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}
