import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import type {
  CustomerLedger, CustomerOutstanding, ProjectProfitability, PaymentSchedule,
} from "@/types/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/ui/searchable-select";
import { currency, currencyFull, stageLabel, SCHEDULE_STATUS_TONE } from "./helpers";
import {
  Search, Users, Building2, RefreshCw, TrendingUp, TrendingDown, Printer, ChevronLeft,
} from "lucide-react";

const TYPE_TONE: Record<string, string> = {
  INVOICE: "text-emerald-700",
  PAYMENT: "text-emerald-700",
  CREDIT_NOTE: "text-cyan-700",
  DEBIT_NOTE: "text-orange-700",
  REFUND: "text-rose-700",
  REVERSAL: "text-slate-500",
};

type View = "customers" | "projects";

/**
 * One home for every "who owes what / how is each project doing" view:
 *  · Customers → outstanding balances + the full customer ledger (was Outstanding + Ledger)
 *  · Projects  → profit card, cost breakdown and payment plan (was Profitability)
 */
export default function AccountsPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const initialView: View =
    location.pathname.includes("profitability") || params.get("view") === "projects" ? "projects" : "customers";
  const [view, setView] = useState<View>(initialView);

  return (
    <div className="space-y-4">
      {/* Customers | Projects toggle — the one control that decides what you're looking at. */}
      <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
        <ToggleBtn active={view === "customers"} onClick={() => setView("customers")} icon={Users} label="Customers" />
        <ToggleBtn active={view === "projects"} onClick={() => setView("projects")} icon={Building2} label="Projects" />
      </div>

      {view === "customers"
        ? <CustomersView params={params} setParams={setParams} />
        : <ProjectsView />}
    </div>
  );
}

function ToggleBtn({ active, onClick, icon: Icon, label }: {
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

/* ============================== Customers ============================== */

function CustomersView({ params, setParams }: {
  params: URLSearchParams; setParams: (p: Record<string, string>) => void;
}) {
  const customerId = params.get("customerId") ?? "";
  const [rows, setRows] = useState<CustomerOutstanding[]>([]);
  const [allCustomers, setAllCustomers] = useState<{ id: number; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");

  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [outstanding, setOutstanding] = useState<CustomerOutstanding | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    financeApi.getAllOutstanding().then((r) => { setRows(r); setLoaded(true); }).catch(console.error);
    api.get("/customers?size=500").then((res) => setAllCustomers(res.data?.content ?? res.data ?? [])).catch(console.error);
  }, []);

  const loadDetail = useCallback(() => {
    if (!customerId) { setLedger(null); setOutstanding(null); return; }
    financeApi.getCustomerLedger(Number(customerId), from || undefined, to || undefined).then(setLedger).catch(console.error);
    financeApi.getCustomerOutstanding(Number(customerId)).then(setOutstanding).catch(console.error);
  }, [customerId, from, to]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const select = (id: string) => setParams(id ? { view: "customers", customerId: id } : { view: "customers" });

  const filtered = rows.filter((r) => r.customerName?.toLowerCase().includes(search.toLowerCase()));
  const totals = filtered.reduce(
    (a, r) => ({ out: a.out + r.totalOutstanding, over: a.over + r.overdueAmount }),
    { out: 0, over: 0 });

  return (
    <div className="space-y-4">
      {/* Company receivables at a glance */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Total Outstanding" value={currency(totals.out)} tone="text-amber-700" />
        <Kpi label="Overdue" value={currency(totals.over)} tone="text-red-600" />
        <Kpi label="Customers with Dues" value={String(filtered.length)} tone="text-slate-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_1.5fr] gap-5">
        {/* Master: who owes money */}
        <div className={`space-y-3 ${customerId ? "hidden lg:block" : ""}`}>
          <div className="flex items-center bg-white border rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input className="outline-none text-sm w-full" placeholder="Search customers with dues…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="bg-white border rounded-xl p-2">
            <div className="text-[11px] uppercase font-bold text-slate-400 px-2 pt-1 pb-2">Look up any customer</div>
            <SearchableSelect value={customerId} onChange={select}
              options={allCustomers.map((c) => ({ value: String(c.id), label: c.name }))}
              placeholder="Search all customers…" clearLabel="— clear —" />
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((r) => {
              const active = String(r.customerId) === customerId;
              const overLimit = r.creditLimit != null && r.totalOutstanding > Number(r.creditLimit);
              return (
                <button key={r.customerId} onClick={() => select(String(r.customerId))}
                  className={`w-full text-left bg-white border rounded-xl p-3 shadow-sm hover:shadow transition ${active ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{r.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.openInvoices ?? 0} open invoice{(r.openInvoices ?? 0) === 1 ? "" : "s"}
                        {r.phone ? ` · ${r.phone}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-amber-700">{currency(r.totalOutstanding)}</div>
                      {r.overdueAmount > 0 && <div className="text-xs font-bold text-red-600">{currency(r.overdueAmount)} overdue</div>}
                    </div>
                  </div>
                  {overLimit && <div className="mt-1 text-[10px] uppercase font-black text-red-600">Over credit limit</div>}
                </button>
              );
            })}
            {loaded && filtered.length === 0 && (
              <div className="bg-white border rounded-xl p-8 text-center text-sm text-muted-foreground">
                No outstanding balances. 🎉<br />Use “Look up any customer” to view any ledger.
              </div>
            )}
          </div>
        </div>

        {/* Detail: this customer's account */}
        <div className={customerId ? "" : "hidden lg:block"}>
          {customerId && ledger ? (
            <div className="space-y-4">
              <button onClick={() => select("")} className="lg:hidden flex items-center gap-1 text-sm font-semibold text-primary">
                <ChevronLeft className="w-4 h-4" /> Back to list
              </button>

              {outstanding && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Kpi label="Outstanding" value={currency(outstanding.totalOutstanding)} tone="text-amber-700" />
                  <Kpi label="Overdue" value={currency(outstanding.overdueAmount)} tone="text-red-600" />
                  <Kpi label="Upcoming Due" value={currency(outstanding.upcomingDue)} tone="text-emerald-700" />
                  <Kpi label="Last Payment" value={outstanding.lastPaymentDate ?? "Never"} tone="text-slate-800" small />
                </div>
              )}

              <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex flex-wrap items-center gap-3 justify-between">
                  <h3 className="font-bold text-slate-800 text-sm">Ledger — {ledger.customerName}</h3>
                  <div className="flex items-center gap-2">
                    <input type="date" className="border rounded-lg px-2 py-1.5 text-sm bg-white" value={from} onChange={(e) => setFrom(e.target.value)} />
                    <span className="text-xs text-muted-foreground">to</span>
                    <input type="date" className="border rounded-lg px-2 py-1.5 text-sm bg-white" value={to} onChange={(e) => setTo(e.target.value)} />
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-1" /> Print
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[680px]">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Debit</th>
                        <th className="px-4 py-3 text-right">Credit</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr className="bg-slate-50/50">
                        <td className="px-4 py-2.5 text-muted-foreground" colSpan={6}>Opening balance</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{currencyFull(ledger.openingBalance)}</td>
                      </tr>
                      {ledger.entries.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 whitespace-nowrap">{e.date}</td>
                          <td className={`px-4 py-2.5 font-semibold ${TYPE_TONE[e.type] ?? ""}`}>{e.type.replaceAll("_", " ")}</td>
                          <td className="px-4 py-2.5">{e.referenceNumber ?? "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{e.description}</td>
                          <td className="px-4 py-2.5 text-right">{e.debit > 0 ? currencyFull(e.debit) : ""}</td>
                          <td className="px-4 py-2.5 text-right">{e.credit > 0 ? currencyFull(e.credit) : ""}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{currencyFull(e.balance)}</td>
                        </tr>
                      ))}
                      {ledger.entries.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No ledger activity in this period.</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold">
                      <tr>
                        <td colSpan={4} className="px-4 py-3">Closing Balance</td>
                        <td className="px-4 py-3 text-right">{currencyFull(ledger.totalDebit)}</td>
                        <td className="px-4 py-3 text-right">{currencyFull(ledger.totalCredit)}</td>
                        <td className="px-4 py-3 text-right text-slate-900">{currencyFull(ledger.closingBalance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border rounded-2xl p-10 text-center text-sm text-muted-foreground h-full flex items-center justify-center">
              Pick a customer to see their outstanding summary and full ledger —
              opening balance, invoices, payments, notes, refunds and running balance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== Projects ============================== */

function ProjectsView() {
  const [rows, setRows] = useState<ProjectProfitability[]>([]);
  const [selected, setSelected] = useState<ProjectProfitability | null>(null);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    financeApi.getAllProfitability().then((r) => { setRows(r); setLoaded(true); }).catch(console.error);
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (row: ProjectProfitability) => {
    setSelected(row); setSchedules([]);
    try {
      const [fresh, sched] = await Promise.all([
        financeApi.getProjectProfitability(row.projectId),
        financeApi.getSchedules(row.projectId),
      ]);
      setSelected(fresh); setSchedules(sched);
    } catch (e) { console.error(e); }
  };

  const sync = async () => {
    if (!selected) return;
    setBusy(true);
    try { await financeApi.syncProjectExpenses(selected.projectId); await open(selected); load(); }
    catch (e) { console.error(e); } finally { setBusy(false); }
  };

  const totals = useMemo(() => rows.reduce(
    (a, r) => ({ rev: a.rev + r.revenue, cost: a.cost + r.totalExpenses, net: a.net + r.netProfit }),
    { rev: 0, cost: 0, net: 0 }), [rows]);

  const filtered = rows.filter((r) =>
    r.projectName?.toLowerCase().includes(search.toLowerCase()) ||
    (r.customerName ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Total Revenue" value={currency(totals.rev)} tone="text-emerald-700" />
        <Kpi label="Total Cost" value={currency(totals.cost)} tone="text-rose-600" />
        <Kpi label="Net Profit" value={currency(totals.net)} tone={totals.net >= 0 ? "text-emerald-700" : "text-red-600"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={`space-y-3 ${selected ? "hidden lg:block" : ""}`}>
          <div className="flex items-center bg-white border rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input className="outline-none text-sm w-full" placeholder="Search projects…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-3 max-h-[62vh] overflow-y-auto pr-1">
            {filtered.map((r) => (
              <button key={r.projectId} onClick={() => open(r)}
                className={`w-full text-left bg-white border rounded-2xl p-4 shadow-sm hover:shadow transition ${selected?.projectId === r.projectId ? "ring-2 ring-primary" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{r.projectName}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.customerName ?? "—"} · {r.projectStatus ?? ""}</div>
                  </div>
                  <div className={`flex items-center gap-1 font-black shrink-0 ${r.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {r.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {currency(r.netProfit)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <MiniStat value={currency(r.revenue)} label="Revenue" />
                  <MiniStat value={currency(r.totalExpenses)} label="Cost" />
                  <MiniStat value={`${r.profitPercent}%`} label="Margin"
                    tone={r.profitPercent >= 0 ? "text-emerald-600" : "text-red-600"} />
                </div>
              </button>
            ))}
            {loaded && filtered.length === 0 && (
              <div className="bg-white border rounded-2xl p-10 text-center text-sm text-muted-foreground">No projects found.</div>
            )}
          </div>
        </div>

        <div className={`lg:sticky lg:top-0 h-fit ${selected ? "" : "hidden lg:block"}`}>
          {selected ? (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setSelected(null)} className="lg:hidden text-primary"><ChevronLeft className="w-5 h-5" /></button>
                  <h3 className="font-bold text-slate-800 text-sm truncate">{selected.projectName} — Profit Card</h3>
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={sync}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${busy ? "animate-spin" : ""}`} /> Sync Costs
                </Button>
              </div>
              <div className="p-5 space-y-5">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <Row label="Quotation Value" value={currency(selected.quotationValue)} />
                  <Row label="Budget" value={currency(selected.budget)} />
                  <Row label="Revenue (Invoiced)" value={currency(selected.revenue)} tone="text-emerald-700" />
                  <Row label="Collected" value={currency(selected.collected)} tone="text-emerald-700" />
                  <Row label="Outstanding" value={currency(selected.outstanding)} tone="text-amber-700" />
                  <Row label="Estimated Cost" value={currency(selected.estimatedCost)} />
                  <Row label="Material Cost" value={currency(selected.materialCost)} />
                  <Row label="Labour Cost" value={currency(selected.labourCost)} />
                </dl>

                <div>
                  <div className="text-xs uppercase text-slate-400 font-bold mb-2">Cost Breakdown</div>
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
                      <div className="text-xs text-muted-foreground">No costs recorded yet — hit “Sync Costs”.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase text-slate-400 font-bold mb-2">Invoiced vs Billed (accrual)</div>
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
                </div>

                {/* Actual money in vs out — cash basis */}
                <div>
                  <div className="text-xs uppercase text-slate-400 font-bold mb-2">Actual Money (cash basis)</div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-3">
                    <Row label="Customer Paid" value={currency(selected.customerPaid)} tone="text-emerald-700" />
                    <Row label="Contractor Paid" value={currency(selected.contractorPaid)} tone="text-rose-600" />
                    <Row label="Product Purchase" value={currency(selected.purchasePaid)} tone="text-rose-600" />
                    <Row label="Other Expenses" value={currency(selected.otherExpensesPaid)} tone="text-rose-600" />
                  </dl>
                  <div className={`rounded-xl p-4 flex items-center justify-between ${selected.cashProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Cash Profit</div>
                      <div className="text-[11px] text-slate-500">Paid in − paid out ({currency(selected.cashOut)} out)</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-lg ${selected.cashProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{currency(selected.cashProfit)}</div>
                      <div className={`text-xs font-bold ${selected.cashProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{selected.cashMarginPercent}% margin</div>
                    </div>
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
                          {(s.status === "PENDING" || s.status === "OVERDUE") && (
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
                          )}
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
            <div className="bg-white border rounded-2xl p-10 text-center text-sm text-muted-foreground h-full flex items-center justify-center">
              Select a project to see its full profit card, cost breakdown and stage-wise payment plan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== Bits ============================== */

function Kpi({ label, value, tone, small }: { label: string; value: string; tone: string; small?: boolean }) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className={`${small ? "text-base" : "text-lg"} font-black ${tone} truncate`}>{value}</div>
      <div className="text-xs font-semibold text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function MiniStat({ value, label, tone = "text-slate-800" }: { value: string; label: string; tone?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2">
      <div className={`text-sm font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase font-semibold text-slate-400">{label}</div>
    </div>
  );
}

function Row({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}
