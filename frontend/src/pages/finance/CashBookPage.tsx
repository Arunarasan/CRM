import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import type { Cashbook, TxnDirection } from "@/types/finance";
import { PAYMENT_METHODS } from "@/types/finance";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";
import { currency, currencyFull, stageLabel } from "./helpers";
import {
  ArrowDownCircle, ArrowUpCircle, Plus, Minus, Trash2, TrendingUp, TrendingDown, Scale,
} from "lucide-react";

// Every Cash Book row's source, with a friendly label and colour.
const SOURCE_META: Record<string, { label: string; dir: "IN" | "OUT"; tone: string }> = {
  CUSTOMER_PAYMENT:   { label: "Customer Payment", dir: "IN",  tone: "bg-emerald-100 text-emerald-700" },
  COMPANY_INCOME:     { label: "Other Income",     dir: "IN",  tone: "bg-teal-100 text-teal-700" },
  SUPPLIER_PAYMENT:   { label: "Supplier / Goods", dir: "OUT", tone: "bg-orange-100 text-orange-700" },
  CONTRACTOR_PAYMENT: { label: "Contractor",       dir: "OUT", tone: "bg-amber-100 text-amber-700" },
  PAYROLL:            { label: "Payroll / Salary", dir: "OUT", tone: "bg-purple-100 text-purple-700" },
  PROJECT_EXPENSE:    { label: "Project Expense",  dir: "OUT", tone: "bg-cyan-100 text-cyan-700" },
  COMPANY_EXPENSE:    { label: "Company Overhead", dir: "OUT", tone: "bg-rose-100 text-rose-700" },
};
// Rows the user can delete here (they live in company_transactions).
const DELETABLE = new Set(["COMPANY_INCOME", "COMPANY_EXPENSE"]);

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

export default function CashBookPage() {
  const [from, setFrom] = useState(monthStartStr);
  const [to, setTo] = useState(todayStr);
  const [direction, setDirection] = useState("");   // "", IN, OUT
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Cashbook | null>(null);
  const [loading, setLoading] = useState(false);

  const [projects, setProjects] = useState<{ id: number; projectName?: string; name?: string }[]>([]);
  const [cats, setCats] = useState<{ income: string[]; expense: string[] }>({ income: [], expense: [] });

  // Add income / expense modal
  const [formDir, setFormDir] = useState<TxnDirection | null>(null);
  const [fCategory, setFCategory] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDate, setFDate] = useState(todayStr);
  const [fParty, setFParty] = useState("");
  const [fMethod, setFMethod] = useState("CASH");
  const [fReference, setFReference] = useState("");
  const [fProject, setFProject] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/projects?size=200").then((r) => setProjects(r.data?.content ?? r.data ?? [])).catch(() => {});
    financeApi.getCompanyTransactionCategories().then(setCats).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    financeApi.getCashbook({ from, to, direction, source, search: search.trim() || undefined })
      .then(setData).catch((e) => { console.error(e); toast.error("Could not load the cash book."); })
      .finally(() => setLoading(false));
  }, [from, to, direction, source, search]);

  useEffect(() => { load(); }, [load]);

  const openForm = (dir: TxnDirection) => {
    setFormDir(dir);
    setFCategory(dir === "INCOME" ? (cats.income[cats.income.length - 1] ?? "OTHER_INCOME") : "MISC");
    setFAmount(""); setFParty(""); setFReference(""); setFProject(""); setFDescription("");
    setFMethod("CASH"); setFDate(todayStr());
  };

  const saveTxn = async () => {
    if (!formDir) return;
    if (!fAmount || Number(fAmount) <= 0) { toast.error("Enter a positive amount."); return; }
    if (!fCategory.trim()) { toast.error("Pick a category."); return; }
    setSaving(true);
    try {
      await financeApi.addCompanyTransaction({
        direction: formDir,
        category: fCategory.trim(),
        amount: Number(fAmount),
        txnDate: fDate,
        partyName: fParty.trim() || null,
        partyType: formDir === "INCOME" ? "OTHER" : "OTHER",
        paymentMethod: fMethod || null,
        referenceNumber: fReference.trim() || null,
        project: fProject ? { id: Number(fProject) } : null,
        description: fDescription.trim() || null,
      });
      toast.success(`${formDir === "INCOME" ? "Income" : "Expense"} recorded.`);
      setFormDir(null);
      load();
    } catch (e) { console.error(e); toast.error("Could not save the transaction."); }
    finally { setSaving(false); }
  };

  const del = async (id: number, source: string) => {
    if (!DELETABLE.has(source)) return;
    if (!window.confirm("Delete this recorded transaction?")) return;
    try { await financeApi.deleteCompanyTransaction(id); load(); }
    catch (e) { console.error(e); toast.error("Could not delete."); }
  };

  const catOptions = useMemo(() => {
    const list = formDir === "INCOME" ? cats.income : cats.expense;
    return list.length ? list : (formDir === "INCOME" ? ["OTHER_INCOME"] : ["MISC"]);
  }, [formDir, cats]);

  const sourceOptions = useMemo(
    () => Object.entries(SOURCE_META).map(([value, m]) => ({ value, label: m.label })),
    []);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Money In" value={data?.totalIn} icon={TrendingUp}
          tone="from-emerald-500 to-emerald-600" sub="Customer collections + other income" />
        <SummaryCard title="Money Out" value={data?.totalOut} icon={TrendingDown}
          tone="from-rose-500 to-rose-600" sub="Suppliers, contractors, payroll, overhead" />
        <SummaryCard title="Net Cash Flow" value={data?.net} icon={Scale}
          tone={(data?.net ?? 0) >= 0 ? "from-slate-700 to-slate-900" : "from-red-600 to-red-800"}
          sub={`${data?.count ?? 0} transactions`} signed />
      </div>

      {/* Source breakdown */}
      {data && Object.keys(data.bySource).length > 0 && (
        <div className="bg-white border rounded-2xl shadow-sm p-4">
          <div className="text-xs uppercase font-bold text-slate-500 mb-3">Breakdown by source</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.bySource).map(([src, amt]) => {
              const m = SOURCE_META[src];
              return (
                <button key={src} onClick={() => setSource(source === src ? "" : src)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    source === src ? "ring-2 ring-primary/40 " : ""}${m?.tone ?? "bg-slate-100 text-slate-600"}`}>
                  {m?.label ?? stageLabel(src)} · {currency(amt)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-slate-600">
          From<input type="date" className="mt-1 block border rounded-lg px-2 py-1.5 text-sm"
            value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          To<input type="date" className="mt-1 block border rounded-lg px-2 py-1.5 text-sm"
            value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select className="border rounded-lg px-2 py-2 text-sm" value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="">All flow</option>
          <option value="IN">Money In</option>
          <option value="OUT">Money Out</option>
        </select>
        <div className="min-w-[180px]">
          <SearchableSelect value={source} onChange={setSource} options={sourceOptions}
            placeholder="All sources" clearLabel="All Sources" />
        </div>
        <input className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" placeholder="Search party / reference…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={() => openForm("INCOME")}>
            <Plus className="w-4 h-4 mr-1" /> Add Income
          </Button>
          <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50"
            onClick={() => openForm("EXPENSE")}>
            <Minus className="w-4 h-4 mr-1" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Register */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data?.entries ?? []).map((e) => {
              const m = SOURCE_META[e.source];
              const isIn = e.direction === "IN";
              return (
                <tr key={`${e.source}-${e.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${m?.tone ?? "bg-slate-100"}`}>
                      {isIn ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
                      {m?.label ?? stageLabel(e.source)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{stageLabel(e.category ?? "")}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{e.party ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.reference ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.method ? stageLabel(e.method) : "—"}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
                    {isIn ? "+" : "−"}{currency(e.amount)}
                  </td>
                  <td className="px-2 py-2.5">
                    {DELETABLE.has(e.source) && (
                      <button className="text-slate-300 hover:text-red-500" title="Delete"
                        onClick={() => del(e.id, e.source)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {data && data.entries.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                {loading ? "Loading…" : "No cash movements in this window. Adjust the dates, or record income / an expense."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add income / expense modal */}
      {formDir && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setFormDir(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className={`font-bold ${formDir === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
              {formDir === "INCOME" ? "Record Other Income" : "Record Company Expense"}
            </h3>
            <p className="text-xs text-muted-foreground -mt-2">
              {formDir === "INCOME"
                ? "Non-invoice receipts — interest, scrap or asset sale, commissions, etc."
                : "Overhead & other charges — rent, utilities, marketing, professional fees, etc."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Category</span>
                <input list="cashbook-cats" className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={fCategory} onChange={(e) => setFCategory(e.target.value)} placeholder="Select or type…" />
                <datalist id="cashbook-cats">
                  {catOptions.map((c) => <option key={c} value={c}>{stageLabel(c)}</option>)}
                </datalist>
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Amount</span>
                <input type="number" min={1} className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={fAmount} onChange={(e) => setFAmount(e.target.value)} />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Date</span>
                <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">{formDir === "INCOME" ? "Received from" : "Paid to"}</span>
                <input className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={fParty} onChange={(e) => setFParty(e.target.value)} placeholder="Party name" />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Method</span>
                <select className="mt-1 w-full border rounded-lg px-3 py-2" value={fMethod} onChange={(e) => setFMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{stageLabel(m)}</option>)}
                </select>
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Reference #</span>
                <input className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={fReference} onChange={(e) => setFReference(e.target.value)} placeholder="Txn / cheque no." />
              </label>
            </div>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Project <span className="font-normal text-muted-foreground">(optional)</span></span>
              <div className="mt-1">
                <SearchableSelect value={fProject} onChange={setFProject}
                  options={projects.map((p) => ({ value: String(p.id), label: p.projectName ?? p.name ?? `Project #${p.id}` }))}
                  placeholder="Company-level (no project)" clearLabel="Company-level (no project)" />
              </div>
            </label>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Description</span>
              <textarea className="mt-1 w-full border rounded-lg px-3 py-2" rows={2}
                value={fDescription} onChange={(e) => setFDescription(e.target.value)} />
            </label>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {fAmount && Number(fAmount) > 0 ? currencyFull(Number(fAmount)) : ""}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setFormDir(null)}>Cancel</Button>
                <Button disabled={saving || !fAmount || Number(fAmount) <= 0}
                  className={formDir === "INCOME" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
                  onClick={saveTxn}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, tone, sub, signed }: {
  title: string; value?: number; icon: React.ComponentType<{ className?: string }>;
  tone: string; sub?: string; signed?: boolean;
}) {
  const v = value ?? 0;
  return (
    <div className={`rounded-2xl p-4 text-white bg-gradient-to-br ${tone} shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold opacity-90">{title}</span>
        <Icon className="w-5 h-5 opacity-80" />
      </div>
      <div className="text-2xl font-bold mt-2">{signed && v >= 0 ? "+" : ""}{currency(v)}</div>
      {sub && <div className="text-xs opacity-80 mt-1">{sub}</div>}
    </div>
  );
}
