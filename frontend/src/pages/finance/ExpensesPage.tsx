import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import type { ProjectExpense, CompanyTransaction, RecurringExpense, PageResp } from "@/types/finance";
import { EXPENSE_CATEGORIES } from "@/types/finance";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/ui/searchable-select";
import FileUploadField from "@/components/FileUploadField";
import { resolveFileUrl } from "@/lib/uploadFile";
import { toast } from "@/components/ui/toast";
import { currency, stageLabel } from "./helpers";
import {
  Plus, Trash2, Building2, FolderKanban, Search, Pencil, FileText, CalendarClock,
} from "lucide-react";

type Scope = "project" | "company";

export default function ExpensesPage() {
  const [scope, setScope] = useState<Scope>("project");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
        <Toggle active={scope === "project"} onClick={() => setScope("project")} icon={FolderKanban} label="Project Expenses" />
        <Toggle active={scope === "company"} onClick={() => setScope("company")} icon={Building2} label="Company Expenses" />
      </div>
      {scope === "project" ? <ProjectExpenses /> : <CompanyExpenses />}
    </div>
  );
}

function Toggle({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

/* ============================ Project expenses ============================ */

const SOURCE_TONE: Record<string, string> = {
  MANUAL: "bg-slate-100 text-slate-600",
  PURCHASE_BILL: "bg-emerald-100 text-emerald-700",
  INVENTORY_CONSUMPTION: "bg-cyan-100 text-cyan-700",
  CONTRACTOR_PAYMENT: "bg-orange-100 text-orange-700",
  SALARY: "bg-purple-100 text-purple-700",
};

function ProjectExpenses() {
  const [projects, setProjects] = useState<{ id: number; projectName?: string; name?: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [data, setData] = useState<PageResp<ProjectExpense> | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [eProject, setEProject] = useState("");
  const [eCategory, setECategory] = useState("MISC");
  const [eAmount, setEAmount] = useState("");
  const [eDate, setEDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eVendor, setEVendor] = useState("");
  const [eDescription, setEDescription] = useState("");

  useEffect(() => {
    api.get("/projects?size=200").then((res) => setProjects(res.data?.content ?? res.data ?? [])).catch(console.error);
  }, []);

  const load = useCallback(() => {
    financeApi.getExpenses(projectId ? Number(projectId) : undefined, page, 20).then(setData).catch(console.error);
  }, [projectId, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Costs booked against a project — material, labour, contractor and the like. The big ones sync
        automatically from purchases, inventory &amp; contractor bills, or add a project cost by hand.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[240px]">
          <SearchableSelect value={projectId} onChange={(v) => { setProjectId(v); setPage(0); }}
            options={projects.map((p) => ({ value: String(p.id), label: p.projectName ?? p.name ?? `Project #${p.id}` }))}
            placeholder="All projects" clearLabel="All Projects" />
        </div>
        {projectId && (
          <Button variant="outline" disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await financeApi.syncProjectExpenses(Number(projectId)); load(); }
              catch (e) { console.error(e); } finally { setBusy(false); }
            }}>
            Sync from Purchases / Inventory / Contractors
          </Button>
        )}
        <Button className="ml-auto" onClick={() => { setEProject(projectId); setShowAdd(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Project Expense
        </Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data?.content ?? []).map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">{e.expenseDate}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-800">{e.project?.projectName ?? `#${e.project?.id}`}</td>
                <td className="px-4 py-2.5">{stageLabel(e.category)}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${SOURCE_TONE[e.source] ?? "bg-slate-100"}`}>
                    {stageLabel(e.source)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground max-w-[280px] truncate">{e.description}</td>
                <td className="px-4 py-2.5">{e.vendor ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-bold text-rose-600">{currency(e.amount)}</td>
                <td className="px-2 py-2.5">
                  {e.source === "MANUAL" && (
                    <button className="text-slate-300 hover:text-red-500"
                      onClick={async () => {
                        if (!window.confirm("Delete this expense?")) return;
                        try { await financeApi.deleteExpense(e.id); load(); } catch (err) { console.error(err); }
                      }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data && data.content.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                No project expenses yet. Add one, or sync a project's purchase / inventory / contractor costs.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900">Add Project Expense</h3>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Project</span>
              <div className="mt-1">
                <SearchableSelect value={eProject} onChange={setEProject}
                  options={projects.map((p) => ({ value: String(p.id), label: p.projectName ?? p.name ?? `Project #${p.id}` }))}
                  placeholder="Search project…" />
              </div>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Category</span>
                <select className="mt-1 w-full border rounded-lg px-3 py-2" value={eCategory} onChange={(e) => setECategory(e.target.value)}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{stageLabel(c)}</option>)}
                </select>
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Amount</span>
                <input type="number" min={1} className="mt-1 w-full border rounded-lg px-3 py-2" value={eAmount} onChange={(e) => setEAmount(e.target.value)} />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Date</span>
                <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={eDate} onChange={(e) => setEDate(e.target.value)} />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Vendor</span>
                <input className="mt-1 w-full border rounded-lg px-3 py-2" value={eVendor} onChange={(e) => setEVendor(e.target.value)} />
              </label>
            </div>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Description</span>
              <textarea className="mt-1 w-full border rounded-lg px-3 py-2" rows={2} value={eDescription} onChange={(e) => setEDescription(e.target.value)} />
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Close</Button>
              <Button disabled={busy || !eProject || !eAmount || Number(eAmount) <= 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await financeApi.addExpense({
                      project: { id: Number(eProject) }, category: eCategory, amount: Number(eAmount),
                      expenseDate: eDate, vendor: eVendor || null, description: eDescription || null,
                    });
                    setShowAdd(false); setEAmount(""); setEVendor(""); setEDescription("");
                    load();
                  } catch (e) { console.error(e); } finally { setBusy(false); }
                }}>
                Save Expense
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Company expenses ============================ */

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const PAY_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD"];

function CompanyExpenses() {
  const [heads, setHeads] = useState<RecurringExpense[]>([]);
  const [data, setData] = useState<PageResp<CompanyTransaction> | null>(null);
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState(monthStartStr);
  const [to, setTo] = useState(todayStr);
  const [search, setSearch] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Expense modal (shared by ad-hoc + recurring payment)
  const [showExpense, setShowExpense] = useState(false);
  const [xTitle, setXTitle] = useState("Add Company Expense");
  const [xRecurringId, setXRecurringId] = useState<number | null>(null);
  const [xCategory, setXCategory] = useState("HOSPITALITY");
  const [xAmount, setXAmount] = useState("");
  const [xDate, setXDate] = useState(todayStr);
  const [xParty, setXParty] = useState("");
  const [xMethod, setXMethod] = useState("CASH");
  const [xReference, setXReference] = useState("");
  const [xDescription, setXDescription] = useState("");
  const [xDocument, setXDocument] = useState("");

  // Manage-recurring-head modal
  const [showHead, setShowHead] = useState(false);
  const [hId, setHId] = useState<number | null>(null);
  const [hName, setHName] = useState("");
  const [hCategory, setHCategory] = useState("RENT");
  const [hAmount, setHAmount] = useState("");
  const [hParty, setHParty] = useState("");
  const [hMethod, setHMethod] = useState("BANK_TRANSFER");
  const [hDay, setHDay] = useState("");
  const [hActive, setHActive] = useState(true);
  const [hNotes, setHNotes] = useState("");

  const loadHeads = useCallback(() => {
    financeApi.getRecurringExpenses(false).then(setHeads).catch(console.error);
  }, []);

  useEffect(() => {
    financeApi.getCompanyTransactionCategories().then((c) => setCats(c.expense ?? [])).catch(() => {});
    loadHeads();
  }, [loadHeads]);

  const load = useCallback(() => {
    financeApi.getCompanyTransactions({
      direction: "EXPENSE", from, to, search: search.trim() || undefined, page, size: 20,
    }).then(setData).catch(console.error);
  }, [from, to, search, page]);

  useEffect(() => { load(); }, [load]);

  const pageTotal = (data?.content ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);

  const openAdhoc = () => {
    setXTitle("Add Company Expense"); setXRecurringId(null);
    setXCategory("HOSPITALITY"); setXAmount(""); setXDate(todayStr());
    setXParty(""); setXMethod("CASH"); setXReference(""); setXDescription(""); setXDocument("");
    setShowExpense(true);
  };

  const openHeadPayment = (h: RecurringExpense) => {
    setXTitle(`Record — ${h.name}`); setXRecurringId(h.id);
    setXCategory(h.category || "MISC"); setXAmount(h.defaultAmount != null ? String(h.defaultAmount) : "");
    setXDate(todayStr()); setXParty(h.partyName ?? ""); setXMethod(h.paymentMethod || "BANK_TRANSFER");
    setXReference(""); setXDescription(""); setXDocument("");
    setShowExpense(true);
  };

  const saveExpense = async () => {
    if (!xAmount || Number(xAmount) <= 0) { toast.error("Enter a positive amount."); return; }
    if (!xCategory.trim()) { toast.error("Pick a category."); return; }
    setBusy(true);
    try {
      await financeApi.addCompanyTransaction({
        direction: "EXPENSE", category: xCategory.trim(), amount: Number(xAmount), txnDate: xDate,
        partyName: xParty.trim() || null, paymentMethod: xMethod || null, referenceNumber: xReference.trim() || null,
        description: xDescription.trim() || null, recurringExpenseId: xRecurringId, documentUrl: xDocument || null,
      });
      toast.success("Company expense recorded.");
      setShowExpense(false); setPage(0); load();
    } catch (e) { console.error(e); toast.error("Could not save the expense."); }
    finally { setBusy(false); }
  };

  const openNewHead = () => {
    setHId(null); setHName(""); setHCategory("RENT"); setHAmount(""); setHParty("");
    setHMethod("BANK_TRANSFER"); setHDay(""); setHActive(true); setHNotes(""); setShowHead(true);
  };
  const openEditHead = (h: RecurringExpense) => {
    setHId(h.id); setHName(h.name); setHCategory(h.category); setHAmount(h.defaultAmount != null ? String(h.defaultAmount) : "");
    setHParty(h.partyName ?? ""); setHMethod(h.paymentMethod || "BANK_TRANSFER");
    setHDay(h.dayOfMonth != null ? String(h.dayOfMonth) : ""); setHActive(h.active ?? true);
    setHNotes(h.notes ?? ""); setShowHead(true);
  };
  const saveHead = async () => {
    if (!hName.trim()) { toast.error("Give this expense a name."); return; }
    setBusy(true);
    const body = {
      name: hName.trim(), category: hCategory.trim() || "MISC",
      defaultAmount: hAmount ? Number(hAmount) : null, partyName: hParty.trim() || null,
      paymentMethod: hMethod || null, dayOfMonth: hDay ? Number(hDay) : null,
      active: hActive, notes: hNotes.trim() || null,
    };
    try {
      if (hId) await financeApi.updateRecurringExpense(hId, body);
      else await financeApi.saveRecurringExpense(body);
      toast.success("Recurring expense saved.");
      setShowHead(false); loadHeads();
    } catch (e) { console.error(e); toast.error("Could not save."); }
    finally { setBusy(false); }
  };
  const deleteHead = async () => {
    if (!hId) return;
    if (!window.confirm("Remove this recurring expense? Its past payments stay on record.")) return;
    setBusy(true);
    try { await financeApi.deleteRecurringExpense(hId); setShowHead(false); loadHeads(); }
    catch (e) { console.error(e); toast.error("Could not remove."); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Day-to-day company charges that don’t belong to any project. Set up repeating overheads
        (rent, electricity, internet…) once, then record each month’s bill by hand with the receipt attached —
        every payment reflects in the Cash Book.
      </p>

      {/* Recurring overhead heads */}
      <div className="bg-white border rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <CalendarClock className="w-4 h-4 text-slate-400" /> Recurring Overheads
          </div>
          <Button size="sm" variant="outline" onClick={openNewHead}>
            <Plus className="w-4 h-4 mr-1" /> Add Recurring
          </Button>
        </div>
        {heads.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No recurring expenses yet. Add rent, electricity, internet and other monthly bills to record them in one click.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {heads.map((h) => (
              <div key={h.id} className={`border rounded-xl p-3 ${h.active ? "" : "opacity-60 bg-slate-50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{h.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {stageLabel(h.category)}{h.dayOfMonth ? ` · due ~${h.dayOfMonth}${nth(h.dayOfMonth)}` : ""}
                      {h.active ? "" : " · inactive"}
                    </div>
                  </div>
                  <button className="text-slate-300 hover:text-primary" title="Edit" onClick={() => openEditHead(h)}>
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-1.5 font-semibold text-slate-700">
                  {h.defaultAmount != null ? currency(h.defaultAmount) : <span className="text-slate-400">Variable</span>}
                </div>
                {h.active && (
                  <Button size="sm" className="mt-2 w-full" onClick={() => openHeadPayment(h)}>Record Payment</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters + ad-hoc add */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-slate-600">
          From<input type="date" className="mt-1 block border rounded-lg px-2 py-1.5 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          To<input type="date" className="mt-1 block border rounded-lg px-2 py-1.5 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        </label>
        <div className="flex items-center bg-white border rounded-lg px-3 py-2 flex-1 min-w-[160px]">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input className="outline-none text-sm w-full" placeholder="Search paid-to / note…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Button className="ml-auto bg-rose-600 hover:bg-rose-700" onClick={openAdhoc}>
          <Plus className="w-4 h-4 mr-1" /> Add Company Expense
        </Button>
      </div>

      {/* Recorded expenses */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Paid To</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Bill</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data?.content ?? []).map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 whitespace-nowrap">{t.txnDate}</td>
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">{stageLabel(t.category)}</span>
                  {t.recurringExpenseId && <span className="ml-1 text-[10px] uppercase font-bold text-slate-400">recurring</span>}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{t.partyName ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground max-w-[240px] truncate">{t.description ?? "—"}</td>
                <td className="px-4 py-2.5">{t.paymentMethod ? stageLabel(t.paymentMethod) : "—"}</td>
                <td className="px-4 py-2.5">
                  {t.documentUrl ? (
                    <a href={resolveFileUrl(t.documentUrl)} target="_blank" rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> View
                    </a>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-rose-600">{currency(t.amount)}</td>
                <td className="px-2 py-2.5">
                  <button className="text-slate-300 hover:text-red-500"
                    onClick={async () => {
                      if (!window.confirm("Delete this expense?")) return;
                      try { await financeApi.deleteCompanyTransaction(t.id); load(); }
                      catch (err) { console.error(err); toast.error("Could not delete."); }
                    }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {data && data.content.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                No company expenses in this window. Record refreshments, electricity, rent and other overheads here.
              </td></tr>
            )}
          </tbody>
          {data && data.content.length > 0 && (
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right">Total on this page</td>
                <td className="px-4 py-3 text-right text-rose-700">{currency(pageTotal)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      {/* Expense modal (ad-hoc + recurring payment) */}
      {showExpense && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowExpense(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-rose-700">{xTitle}</h3>
            <p className="text-xs text-muted-foreground -mt-2">
              {xRecurringId ? "Record this period's bill — attach the receipt below." :
                "e.g. visitor refreshments / welcome serves, electricity, office supplies."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm block col-span-2">
                <span className="font-semibold text-slate-700">Category</span>
                <input list="company-exp-cats" className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={xCategory} onChange={(e) => setXCategory(e.target.value)} placeholder="Select or type…" />
                <datalist id="company-exp-cats">
                  {(cats.length ? cats : ["HOSPITALITY", "ELECTRICITY", "RENT", "MISC"]).map((c) => (
                    <option key={c} value={c}>{stageLabel(c)}</option>
                  ))}
                </datalist>
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Amount</span>
                <input type="number" min={1} className="mt-1 w-full border rounded-lg px-3 py-2" value={xAmount} onChange={(e) => setXAmount(e.target.value)} />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Date</span>
                <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" value={xDate} onChange={(e) => setXDate(e.target.value)} />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Paid To</span>
                <input className="mt-1 w-full border rounded-lg px-3 py-2" value={xParty} onChange={(e) => setXParty(e.target.value)} placeholder="Shop / person" />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Method</span>
                <select className="mt-1 w-full border rounded-lg px-3 py-2" value={xMethod} onChange={(e) => setXMethod(e.target.value)}>
                  {PAY_METHODS.map((m) => <option key={m} value={m}>{stageLabel(m)}</option>)}
                </select>
              </label>
              <label className="text-sm block col-span-2">
                <span className="font-semibold text-slate-700">Reference # <span className="font-normal text-muted-foreground">(optional)</span></span>
                <input className="mt-1 w-full border rounded-lg px-3 py-2" value={xReference} onChange={(e) => setXReference(e.target.value)} placeholder="Bill / txn no." />
              </label>
            </div>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Description</span>
              <textarea className="mt-1 w-full border rounded-lg px-3 py-2" rows={2} value={xDescription} onChange={(e) => setXDescription(e.target.value)} placeholder="What was it for?" />
            </label>
            <FileUploadField module="FINANCE" label="Bill / Receipt (optional)" value={xDocument}
              accept="image/*,application/pdf" onChange={({ url }) => setXDocument(url)} />
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowExpense(false)}>Close</Button>
              <Button className="bg-rose-600 hover:bg-rose-700" disabled={busy || !xAmount || Number(xAmount) <= 0} onClick={saveExpense}>
                {busy ? "Saving…" : "Save Expense"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manage recurring head modal */}
      {showHead && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowHead(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900">{hId ? "Edit Recurring Expense" : "Add Recurring Expense"}</h3>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Name</span>
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={hName} onChange={(e) => setHName(e.target.value)} placeholder="e.g. Office Rent, Shop Electricity" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Category</span>
                <input list="company-exp-cats" className="mt-1 w-full border rounded-lg px-3 py-2" value={hCategory} onChange={(e) => setHCategory(e.target.value)} />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Usual Amount <span className="font-normal text-muted-foreground">(optional)</span></span>
                <input type="number" min={0} className="mt-1 w-full border rounded-lg px-3 py-2" value={hAmount} onChange={(e) => setHAmount(e.target.value)} placeholder="blank if variable" />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Paid To</span>
                <input className="mt-1 w-full border rounded-lg px-3 py-2" value={hParty} onChange={(e) => setHParty(e.target.value)} placeholder="Landlord / provider" />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Usual Method</span>
                <select className="mt-1 w-full border rounded-lg px-3 py-2" value={hMethod} onChange={(e) => setHMethod(e.target.value)}>
                  {PAY_METHODS.map((m) => <option key={m} value={m}>{stageLabel(m)}</option>)}
                </select>
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Due Day <span className="font-normal text-muted-foreground">(1–31)</span></span>
                <input type="number" min={1} max={31} className="mt-1 w-full border rounded-lg px-3 py-2" value={hDay} onChange={(e) => setHDay(e.target.value)} placeholder="e.g. 5" />
              </label>
              <label className="text-sm flex items-center gap-2 mt-6">
                <input type="checkbox" className="w-4 h-4" checked={hActive} onChange={(e) => setHActive(e.target.checked)} />
                <span className="font-semibold text-slate-700">Active</span>
              </label>
            </div>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Notes</span>
              <textarea className="mt-1 w-full border rounded-lg px-3 py-2" rows={2} value={hNotes} onChange={(e) => setHNotes(e.target.value)} />
            </label>
            <div className="flex gap-2 justify-between pt-1">
              <div>
                {hId && <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busy} onClick={deleteHead}>Remove</Button>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowHead(false)}>Close</Button>
                <Button disabled={busy || !hName.trim()} onClick={saveHead}>{busy ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const nth = (d: number) => (d >= 11 && d <= 13) ? "th" : ["th", "st", "nd", "rd"][d % 10] ?? "th";
