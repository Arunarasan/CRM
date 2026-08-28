import { useCallback, useEffect, useState } from "react";
import { financeApi } from "@/api/financeApi";
import type { ProjectProfitability, PaymentSchedule } from "@/types/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency, SCHEDULE_STATUS_TONE, stageLabel } from "./helpers";
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

export default function ProfitabilityPage() {
  const [rows, setRows] = useState<ProjectProfitability[]>([]);
  const [selected, setSelected] = useState<ProjectProfitability | null>(null);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    financeApi.getAllProfitability().then((r) => { setRows(r); setLoaded(true); }).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (row: ProjectProfitability) => {
    setSelected(row);
    try {
      const [fresh, sched] = await Promise.all([
        financeApi.getProjectProfitability(row.projectId),
        financeApi.getSchedules(row.projectId),
      ]);
      setSelected(fresh);
      setSchedules(sched);
    } catch (e) { console.error(e); }
  };

  const sync = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await financeApi.syncProjectExpenses(selected.projectId);
      await open(selected);
      load();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        {rows.map((r) => (
          <button key={r.projectId} onClick={() => open(r)}
                  className={`w-full text-left bg-white border rounded-2xl p-4 shadow-sm hover:shadow transition-shadow ${selected?.projectId === r.projectId ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-slate-800">{r.projectName}</div>
                <div className="text-xs text-muted-foreground">{r.customerName ?? "—"} · {r.projectStatus ?? ""}</div>
              </div>
              <div className={`flex items-center gap-1 font-black ${r.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {r.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {currency(r.netProfit)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-sm font-bold text-slate-800">{currency(r.revenue)}</div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">Revenue</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-sm font-bold text-slate-800">{currency(r.totalExpenses)}</div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">Expenses</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className={`text-sm font-bold ${r.profitPercent >= 0 ? "text-emerald-600" : "text-red-600"}`}>{r.profitPercent}%</div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">Margin</div>
              </div>
            </div>
          </button>
        ))}
        {loaded && rows.length === 0 && (
          <div className="bg-white border rounded-2xl p-10 text-center text-sm text-muted-foreground">No projects found.</div>
        )}
      </div>

      <div className="lg:sticky lg:top-0 h-fit">
        {selected ? (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">{selected.projectName} — Profit Card</h3>
              <Button size="sm" variant="outline" disabled={busy} onClick={sync}>
                <RefreshCw className={`w-4 h-4 mr-1 ${busy ? "animate-spin" : ""}`} /> Sync Costs
              </Button>
            </div>
            <div className="p-5 space-y-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Quotation Value</dt><dd className="font-semibold">{currency(selected.quotationValue)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Budget</dt><dd className="font-semibold">{currency(selected.budget)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Revenue (Invoiced)</dt><dd className="font-semibold text-emerald-700">{currency(selected.revenue)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Collected</dt><dd className="font-semibold text-emerald-700">{currency(selected.collected)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Outstanding</dt><dd className="font-semibold text-amber-700">{currency(selected.outstanding)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Estimated Cost</dt><dd className="font-semibold">{currency(selected.estimatedCost)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Material Cost</dt><dd className="font-semibold">{currency(selected.materialCost)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Labour Cost</dt><dd className="font-semibold">{currency(selected.labourCost)}</dd></div>
              </dl>

              <div>
                <div className="text-xs uppercase text-slate-400 font-bold mb-2">Expense Breakdown</div>
                <div className="space-y-1.5">
                  {Object.entries(selected.expensesByCategory ?? {}).map(([cat, amt]) => {
                    const pct = selected.totalExpenses > 0 ? (Number(amt) / selected.totalExpenses) * 100 : 0;
                    return (
                      <div key={cat} className="flex items-center gap-2 text-xs">
                        <span className="w-24 font-semibold text-slate-600">{stageLabel(cat)}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-20 text-right font-semibold">{currency(Number(amt))}</span>
                      </div>
                    );
                  })}
                  {Object.keys(selected.expensesByCategory ?? {}).length === 0 && (
                    <div className="text-xs text-muted-foreground">No expenses recorded yet — hit “Sync Costs”.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="font-black text-slate-900">{currency(selected.grossProfit)}</div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Gross Profit</div>
                </div>
                <div className={`rounded-xl p-3 ${selected.netProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                  <div className={`font-black ${selected.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{currency(selected.netProfit)}</div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Net Profit</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="font-black text-slate-900">{selected.profitPercent}%</div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Profit %</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase text-slate-400 font-bold">Payment Plan</div>
                  {schedules.length === 0 && (
                    <Button size="sm" variant="outline" disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try { setSchedules(await financeApi.generateDefaultSchedule(selected.projectId)); }
                              catch (e) { console.error(e); } finally { setBusy(false); }
                            }}>
                      Generate 8-Stage Plan
                    </Button>
                  )}
                </div>
                <div className="divide-y border rounded-xl overflow-hidden">
                  {schedules.map((s) => (
                    <div key={s.id} className="p-3 flex items-center justify-between text-sm bg-white">
                      <div>
                        <div className="font-semibold text-slate-800">{stageLabel(s.stage)}
                          {s.percentage != null && <span className="text-xs text-muted-foreground"> · {s.percentage}%</span>}
                        </div>
                        {s.dueDate && <div className="text-xs text-muted-foreground">due {s.dueDate}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{currency(s.amount)}</span>
                        <Badge className={SCHEDULE_STATUS_TONE[s.status]}>{s.status}</Badge>
                        {s.status === "PENDING" || s.status === "OVERDUE" ? (
                          <Button size="sm" variant="outline" disabled={busy}
                                  onClick={async () => {
                                    setBusy(true);
                                    try {
                                      await financeApi.generateStageInvoice(s.id);
                                      setSchedules(await financeApi.getSchedules(selected.projectId));
                                    } catch (e) { console.error(e); } finally { setBusy(false); }
                                  }}>
                            Invoice
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {schedules.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground bg-white">No payment plan yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Select a project to see its full profit card, expense breakdown and stage-wise payment plan.
          </div>
        )}
      </div>
    </div>
  );
}
