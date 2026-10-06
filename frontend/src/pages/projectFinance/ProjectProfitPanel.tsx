import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  TrendingUp, TrendingDown, RefreshCw, Loader2, Plus, Trash2, Receipt, Minus, Equal,
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

const CAT_COLORS = ["bg-emerald-600", "bg-amber-500", "bg-sky-600", "bg-rose-500", "bg-violet-500", "bg-slate-500", "bg-cyan-600"];
const sourceLabel = (s?: string) => {
  const v = (s || "MANUAL").toUpperCase();
  if (v === "MANUAL") return "Manual";
  if (v.includes("PURCHASE") || v.includes("PO")) return "Purchase";
  if (v.includes("CONTRACT")) return "Contractor";
  if (v.includes("PAYROLL") || v.includes("LABOUR")) return "Labour";
  return v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");
};

/**
 * Expenses & Profit for one project. A "money in − money out = profit" card that switches between
 * cash basis (money that actually moved) and booked basis (invoiced vs billed cost), where the money
 * went by type, and every expense booked against the project with a quick "Add expense".
 */
export default function ProjectProfitPanel({ project, refreshSignal = 0, part = "both", compact, onChanged }: {
  project: any;
  refreshSignal?: number;
  /** Which card(s) to render — the combined Billing & Payments view places them separately. */
  part?: "both" | "profit" | "expenses";
  /** Tighter layout: smaller profit tiles, latest expenses only (with "show all"). */
  compact?: boolean;
  /** Told after an expense is added/deleted, so sibling money views refresh. */
  onChanged?: () => void;
}) {
  const { hasAuthority } = useAuth();
  const canRead = hasAuthority("FINANCE_READ");
  const canWrite = hasAuthority("FINANCE_WRITE");
  const projectId = project?.id;

  const [prof, setProf] = useState<ProjectProfitability | null>(null);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [basis, setBasis] = useState<"cash" | "booked">("cash");
  const [catFilter, setCatFilter] = useState<string>("ALL");
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const needProf = part !== "expenses";
  const needExp = part !== "profit";

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    // getProjectProfitability re-syncs costs server-side, so it reflects the latest bills.
    Promise.all([
      needProf ? financeApi.getProjectProfitability(projectId) : Promise.resolve(null),
      needExp ? financeApi.getExpenses(projectId, 0, 200) : Promise.resolve(null),
    ])
      .then(([p, e]) => { if (p) setProf(p); if (e) setExpenses(e.content || []); })
      .catch((err) => { if (err?.response?.status !== 403) console.error(err); })
      .finally(() => setLoading(false));
  }, [projectId, needProf, needExp]);

  useEffect(load, [load]);
  // Refetch when the parent signals a billing/payment change.
  useEffect(() => { if (refreshSignal) load(); }, [refreshSignal, load]);

  // Expenses grouped by category (largest first) — "where the money went".
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    expenses.forEach((e) => m.set(e.category, (m.get(e.category) || 0) + Number(e.amount || 0)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const expenseTotal = byCategory.reduce((s, [, v]) => s + v, 0);

  const sync = async () => {
    setBusy(true);
    try { await financeApi.syncProjectExpenses(projectId); load(); toast.success("Costs synced"); }
    catch (e) { console.error(e); } finally { setBusy(false); }
  };

  if (!canRead) {
    return <div className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-500">You don't have access to project profit.</div>;
  }
  if (loading && (needProf ? !prof : expenses.length === 0)) {
    return <div className="flex justify-center rounded-2xl border border-slate-100 bg-white py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (needProf && !prof) return null;

  const cash = basis === "cash";
  const pf = prof || ({} as ProjectProfitability);
  const moneyIn = cash ? pf.customerPaid : pf.revenue;
  const moneyOut = cash ? pf.cashOut : pf.totalExpenses;
  const profit = (cash ? pf.cashProfit : pf.netProfit) || 0;
  const margin = cash ? pf.cashMarginPercent : pf.profitPercent;
  const outParts: [string, number][] = cash
    ? [["Contractor paid", pf.contractorPaid], ["Product purchase", pf.purchasePaid], ["Other expenses", pf.otherExpensesPaid]]
    : [["Material cost", pf.materialCost], ["Labour / contractor", pf.labourCost], ["Other", Math.max(0, (pf.totalExpenses || 0) - (pf.materialCost || 0) - (pf.labourCost || 0))]];
  const filtered = catFilter === "ALL" ? expenses : expenses.filter((e) => e.category === catFilter);
  const shown = compact && !showAll ? filtered.slice(0, 5) : filtered;
  const positive = profit >= 0;
  const OUT_COLORS = ["bg-rose-500", "bg-amber-500", "bg-slate-400"];

  return (
    <div className="space-y-3 @container">
      {/* Profit equation */}
      {needProf && <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(17,24,23,0.04)]">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-700" /> Profit</h3>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
              {([["cash", "Cash in hand"], ["booked", "Booked"]] as const).map(([b, label]) => (
                <button key={b} type="button" onClick={() => setBasis(b)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${basis === b ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  {label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" disabled={busy} onClick={sync} className="h-8" title="Re-read purchases, contractor bills and payroll for this project">
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> <span className="hidden @lg:inline ml-1">Sync costs</span>
            </Button>
          </div>
        </div>
        <div className={compact ? "p-3" : "p-4"}>
          {compact ? (
            <div className="grid grid-cols-3 gap-2">
              {([[cash ? "Customer paid" : "Invoiced", moneyIn, "bg-emerald-50", "text-emerald-800"], [cash ? "Paid out" : "Total cost", moneyOut, "bg-rose-50", "text-rose-800"]] as [string, number, string, string][]).map(([l, v, bg, fg]) => (
                <div key={l} className={`rounded-xl ${bg} px-2.5 py-2 min-w-0`}>
                  <div className={`text-[10px] font-semibold ${fg} truncate`}>{l}</div>
                  <div className="mt-0.5 text-sm font-bold text-slate-900 truncate">{inr(v)}</div>
                </div>
              ))}
              <div className={`rounded-xl px-2.5 py-2 min-w-0 text-white ${positive ? "bg-emerald-800" : "bg-rose-600"}`}>
                <div className="text-[10px] font-semibold text-white/80 truncate">{positive ? "Profit" : "Loss"} · {Number(margin || 0).toFixed(1)}%</div>
                <div className="mt-0.5 text-sm font-bold truncate">{inr(profit)}</div>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 @2xl:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-2">
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <div className="text-[11px] font-semibold text-emerald-800">{cash ? "Customer paid" : "Invoiced"}</div>
              <div className="mt-1 text-xl font-bold text-slate-900 truncate">{inr(moneyIn)}</div>
              <div className="text-[11px] text-emerald-700/80">money in</div>
            </div>
            <div className="hidden @2xl:flex items-center justify-center text-2xl font-light text-slate-300"><Minus className="h-5 w-5" /></div>
            <div className="rounded-2xl bg-rose-50 px-4 py-3">
              <div className="text-[11px] font-semibold text-rose-800">{cash ? "Paid out" : "Total cost"}</div>
              <div className="mt-1 text-xl font-bold text-slate-900 truncate">{inr(moneyOut)}</div>
              <div className="text-[11px] text-rose-700/80">money out</div>
            </div>
            <div className="hidden @2xl:flex items-center justify-center text-2xl font-light text-slate-300"><Equal className="h-5 w-5" /></div>
            <div className={`rounded-2xl px-4 py-3 ${positive ? "bg-emerald-800 text-white" : "bg-rose-600 text-white"}`}>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-white/80">
                {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />} {positive ? "Profit" : "Loss"}
              </div>
              <div className="mt-1 text-xl font-bold truncate">{inr(profit)}</div>
              <div className="text-[11px] text-white/80">{Number(margin || 0).toFixed(1)}% margin</div>
            </div>
          </div>
          )}

          {/* Money out, broken down */}
          {compact ? (
            <div className="mt-2.5">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                {outParts.map(([label, val], idx) => (
                  <div key={label} className={OUT_COLORS[idx]} style={{ width: `${moneyOut ? (Number(val || 0) / moneyOut) * 100 : 0}%` }} />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                {outParts.map(([label, val], idx) => (
                  <span key={label} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${OUT_COLORS[idx]}`} /> {label} <span className="font-semibold text-slate-700">{inr(val)}</span></span>
                ))}
              </div>
            </div>
          ) : (
          <div className="mt-3 grid grid-cols-1 @xl:grid-cols-3 gap-2">
            {outParts.map(([label, val]) => {
              const pct = moneyOut ? Math.round((Number(val || 0) / moneyOut) * 100) : 0;
              return (
                <div key={label} className="rounded-xl border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-500">{label}</span>
                    <span className="text-slate-400">{pct}%</span>
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-slate-900">{inr(val)}</div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-rose-400" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
          )}
          {cash && !compact && Number(pf.outstanding || 0) > 0 && (
            <p className="mt-2 text-[11px] text-slate-400">Still to collect from the customer: <span className="font-semibold text-slate-600">{inr(pf.outstanding)}</span> — profit grows as it comes in.</p>
          )}
        </div>
      </section>}

      {/* Expenses */}
      {needExp && <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(17,24,23,0.04)]">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Receipt className="h-4 w-4 text-emerald-700" /> Expenses</h3>
            <span className="rounded-full bg-slate-100 px-1.5 py-px text-[11px] font-semibold tabular-nums text-slate-500">{inr(expenseTotal)}</span>
          </div>
          {canWrite && !adding && (
            <Button size="sm" variant="forest" onClick={() => setAdding(true)} className="active:scale-[0.98]"><Plus /> Add expense</Button>
          )}
        </div>
        <div className={compact ? "p-3 space-y-2.5" : "p-4 space-y-3"}>
          {canWrite && adding && <QuickAddExpense projectId={projectId} onAdded={() => { load(); setAdding(false); onChanged?.(); }} onCancel={() => setAdding(false)} />}

          {/* By type */}
          {byCategory.length > 0 && (
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                {byCategory.map(([c, v], idx) => (
                  <div key={c} className={CAT_COLORS[idx % CAT_COLORS.length]} style={{ width: `${expenseTotal ? (v / expenseTotal) * 100 : 0}%` }} title={`${catLabel(c)} · ${inr(v)}`} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setCatFilter("ALL")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${catFilter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  All · {expenses.length}
                </button>
                {byCategory.map(([c, v], idx) => (
                  <button key={c} type="button" onClick={() => setCatFilter(c)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${catFilter === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    <span className={`h-2 w-2 rounded-full ${CAT_COLORS[idx % CAT_COLORS.length]}`} /> {catLabel(c)} · {inr(v)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
            {shown.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No expenses booked yet.</p>
            ) : (
              shown.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm hover:bg-slate-50/60">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{e.description || catLabel(e.category)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{catLabel(e.category)}</span>
                      {sourceLabel(e.source) !== catLabel(e.category) && (
                        <span className={`rounded-full px-1.5 py-0.5 font-semibold ${e.source === "MANUAL" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>{sourceLabel(e.source)}</span>
                      )}
                      {e.expenseDate && <span>{format(new Date(e.expenseDate), "dd MMM yyyy")}</span>}
                      {e.vendor && <span>· {e.vendor}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-rose-600">{inr(e.amount)}</span>
                    {canWrite && e.source === "MANUAL" && (
                      <button type="button" title="Delete expense" className="text-slate-300 hover:text-red-500"
                        onClick={() => {
                          if (!confirm("Delete this expense?")) return;
                          financeApi.deleteExpense(e.id).then(() => { load(); onChanged?.(); })
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
          {compact && filtered.length > 5 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full rounded-xl bg-slate-50 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              {showAll ? "Show less" : `Show all ${filtered.length} expenses`}
            </button>
          )}
          {!compact && (
            <p className="text-[11px] text-slate-400">Purchases, contractor bills and payroll are added automatically (Sync costs to refresh). Add travel, shipping, tools and other costs yourself.</p>
          )}
        </div>
      </section>}
    </div>
  );
}

/** Inline form to book a MANUAL project expense (category + amount + date + note). */
function QuickAddExpense({ projectId, onAdded, onCancel }: { projectId: number; onAdded: () => void; onCancel: () => void }) {
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
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-12">
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="col-span-2 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm @2xl:col-span-3">
          {EXPENSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="relative col-span-1 @2xl:col-span-2">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="pl-6 text-right rounded-xl" autoFocus />
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="col-span-1 rounded-xl @2xl:col-span-3" />
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Note (e.g. auto fare)" className="col-span-2 rounded-xl @2xl:col-span-4" />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="outline" className="rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="forest" onClick={add} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Add expense
        </Button>
      </div>
    </div>
  );
}
