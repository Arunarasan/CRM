import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import type { ProjectExpense, PageResp } from "@/types/finance";
import { EXPENSE_CATEGORIES } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { currency, stageLabel } from "./helpers";
import { Plus, Trash2 } from "lucide-react";

const SOURCE_TONE: Record<string, string> = {
  MANUAL: "bg-slate-100 text-slate-600",
  PURCHASE_BILL: "bg-blue-100 text-blue-700",
  INVENTORY_CONSUMPTION: "bg-cyan-100 text-cyan-700",
  CONTRACTOR_PAYMENT: "bg-orange-100 text-orange-700",
  SALARY: "bg-purple-100 text-purple-700",
};

export default function ExpensesPage() {
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
      <div className="flex flex-wrap items-center gap-2">
        <select className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[220px]" value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setPage(0); }}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName ?? p.name}</option>)}
        </select>
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
          <Plus className="w-4 h-4 mr-1" /> Add Expense
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
                No expenses yet. Add one manually or sync a project's purchase / inventory / contractor costs.
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
              <select className="mt-1 w-full border rounded-lg px-3 py-2" value={eProject} onChange={(e) => setEProject(e.target.value)}>
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName ?? p.name}</option>)}
              </select>
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
