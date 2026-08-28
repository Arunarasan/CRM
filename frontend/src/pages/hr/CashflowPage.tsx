import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { payrollApi } from "@/api/payrollApi";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  BadgeIndianRupee, HandCoins, Wallet, Landmark, Gift, HardHat,
  TrendingUp, TrendingDown, CircleHelp, RotateCcw, AlertCircle,
} from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const num = (v: any) => Number(v || 0);
const fmtDate = (v?: string | null) => { if (!v) return "—"; const d = new Date(v); return isNaN(d.getTime()) ? "—" : format(d, "MMM d"); };

const CAT_LABEL: Record<string, string> = {
  SALARY: "Salary", ADVANCE: "Advance", LOAN: "Loan", BONUS: "Bonus", CONTRACTOR: "Contractor",
};
const CAT_TONE: Record<string, string> = {
  SALARY: "bg-emerald-100 text-emerald-700", ADVANCE: "bg-cyan-100 text-cyan-700",
  LOAN: "bg-violet-100 text-violet-700", BONUS: "bg-pink-100 text-pink-700", CONTRACTOR: "bg-amber-100 text-amber-700",
};
const CAT_FILTERS = ["ALL", "SALARY", "ADVANCE", "LOAN", "BONUS", "CONTRACTOR"];

type Row = { key: string; label: string; icon: any; tone: string };

// Money out — real cost vs recoverable
const EXPENSE_ROWS: Row[] = [
  { key: "salaries", label: "Employee salaries", icon: HandCoins, tone: "text-emerald-600" },
  { key: "bonuses", label: "Bonuses paid", icon: Gift, tone: "text-pink-600" },
  { key: "contractors", label: "Contractor payments", icon: HardHat, tone: "text-amber-600" },
];
const RECOVERABLE_ROWS: Row[] = [
  { key: "advances", label: "Advances given", icon: Wallet, tone: "text-cyan-600" },
  { key: "loans", label: "Loans disbursed", icon: Landmark, tone: "text-violet-600" },
];
// Money in — recoveries from staff
const MONEYIN_ROWS: Row[] = [
  { key: "advanceRecovery", label: "Advance recovery", icon: RotateCcw, tone: "text-cyan-600" },
  { key: "loanRecovery", label: "Loan recovery", icon: Landmark, tone: "text-violet-600" },
];
// Balances — payables vs receivables
const PAYABLE_ROWS: Row[] = [
  { key: "salaryDue", label: "Salary payable", icon: HandCoins, tone: "text-emerald-600" },
  { key: "contractorOutstanding", label: "Contractor outstanding", icon: HardHat, tone: "text-amber-600" },
];
const RECEIVABLE_ROWS: Row[] = [
  { key: "advancesOutstanding", label: "Advances to recover", icon: Wallet, tone: "text-cyan-600" },
  { key: "loansOutstanding", label: "Loans outstanding", icon: Landmark, tone: "text-violet-600" },
];

const sumRows = (rows: Row[], values: Record<string, any>) => rows.reduce((s, r) => s + num(values[r.key]), 0);

export default function CashflowPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    payrollApi.cashflow(month, year).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [month, year]);

  const paid = data?.paid || {};
  const owed = data?.owed || {};
  const moneyIn = data?.moneyIn || {};

  const expenseTotal = useMemo(() => sumRows(EXPENSE_ROWS, paid), [paid]);
  const recoverableTotal = useMemo(() => sumRows(RECOVERABLE_ROWS, paid), [paid]);
  const moneyInTotal = useMemo(() => sumRows(MONEYIN_ROWS, moneyIn), [moneyIn]);
  const payableTotal = useMemo(() => sumRows(PAYABLE_ROWS, owed), [owed]);
  const receivableTotal = useMemo(() => sumRows(RECEIVABLE_ROWS, owed), [owed]);
  const moneyOutTotal = expenseTotal + recoverableTotal;
  const netCashOut = moneyOutTotal - moneyInTotal;

  const txns = data?.transactions || [];
  const filteredTxns = useMemo(
    () => (catFilter === "ALL" ? txns : txns.filter((t: any) => t.category === catFilter)),
    [txns, catFilter],
  );
  const filteredTotal = useMemo(() => filteredTxns.reduce((s: number, t: any) => s + num(t.amount), 0), [filteredTxns]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <TrendingUp className="w-6 h-6 text-emerald-600" /> Workforce cashflow
          </h2>
          <p className="text-sm text-slate-500">Real cost vs recoverable cash out, and what you owe vs what’s coming back.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-10 rounded-lg border bg-white px-3 text-sm font-semibold shadow-sm"
            value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <Input type="number" className="h-10 w-24 font-semibold" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </div>

      {/* headline cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeadlineCard tone="rose" icon={<TrendingDown className="w-5 h-5" />} label={`Total expense — ${MONTHS[month - 1]}`} value={inr(expenseTotal)} hint="real cost this month" />
        <HeadlineCard tone="cyan" icon={<RotateCcw className="w-5 h-5" />} label="Recoverable out" value={inr(recoverableTotal)} hint="advances & loans — comes back" />
        <HeadlineCard tone="amber" icon={<AlertCircle className="w-5 h-5" />} label="You owe" value={inr(payableTotal)} hint={`still to pay · ${MONTHS[month - 1]}`} />
        <HeadlineCard tone="emerald" icon={<TrendingUp className="w-5 h-5" />} label="Owed to you" value={inr(receivableTotal)} hint={`to recover · ${MONTHS[month - 1]}`} />
      </div>

      {loading && <div className="text-sm text-slate-400">Loading cashflow…</div>}

      {/* MONEY OUT — expense vs recoverable */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <TrendingDown className="w-4 h-4" /> Money out — {MONTHS[month - 1]} {year}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BreakdownCard title="Expenses (real cost)" note="Actual cost to the company — never recovered." rows={EXPENSE_ROWS} values={paid} total={expenseTotal} barBg="bg-rose-500/80" emptyText="No expenses this month." />
          <BreakdownCard title="Recoverable (not an expense)" note="Cash lent to staff — recovered from future salary." rows={RECOVERABLE_ROWS} values={paid} total={recoverableTotal} barBg="bg-cyan-500/80" emptyText="No advances or loans disbursed this month." />
        </div>
      </div>

      {/* MONEY IN — recoveries from staff */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <RotateCcw className="w-4 h-4" /> Money in — {MONTHS[month - 1]} {year}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BreakdownCard title="Recovered (money in)" note="Advances & loans recovered from the salaries paid this month." rows={MONEYIN_ROWS} values={moneyIn} total={moneyInTotal} barBg="bg-emerald-500/80" emptyText="Nothing recovered this month." />
          <div className="bg-white border rounded-2xl shadow-sm p-5 flex flex-col justify-center">
            <h3 className="font-bold text-slate-800 mb-3">Net cash movement</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-500">Money out (expense + recoverable)</span><span className="font-semibold text-rose-600">− {inr(moneyOutTotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Money in (recovery)</span><span className="font-semibold text-emerald-600">+ {inr(moneyInTotal)}</span></div>
              <div className="flex items-center justify-between border-t pt-2 mt-1"><span className="font-bold text-slate-800">Net cash out</span><span className="text-xl font-black text-slate-900">{inr(netCashOut)}</span></div>
            </div>
            <p className="text-xs text-slate-400 mt-3">Actual cash that left the bank this month, after recoveries came back.</p>
          </div>
        </div>
      </div>

      {/* BALANCES — payables vs receivables (month-scoped) */}
      <div>
        <h3 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <BadgeIndianRupee className="w-4 h-4" /> Balances — {MONTHS[month - 1]} {year}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold normal-case text-slate-500">still open, booked this month</span>
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BreakdownCard title="You owe (payables)" note="Unpaid payslips & contractor bills booked this month." rows={PAYABLE_ROWS} values={owed} total={payableTotal} barBg="bg-amber-500/80" emptyText="You owe nothing for this month." />
          <BreakdownCard title="Owed to you (receivables)" note="Advances/loans given this month, still to recover." rows={RECEIVABLE_ROWS} values={owed} total={receivableTotal} barBg="bg-emerald-500/80" emptyText="Nothing to recover from this month." />
        </div>
      </div>

      {/* detail list — every payment made this month */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800">Payments made — {MONTHS[month - 1]} {year}</h3>
            <p className="text-xs text-slate-500">{filteredTxns.length} payment{filteredTxns.length === 1 ? "" : "s"} · {inr(filteredTotal)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CAT_FILTERS.map((c) => (
              <button key={c} type="button" onClick={() => setCatFilter(c)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors ${catFilter === c ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {c === "ALL" ? "All" : CAT_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Paid to</th>
                <th className="text-left p-3">Reference</th>
                <th className="text-right p-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.map((t: any, i: number) => (
                <tr key={i} className="border-t hover:bg-slate-50/70">
                  <td className="p-3 whitespace-nowrap text-slate-600">{fmtDate(t.date)}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${CAT_TONE[t.category] || "bg-slate-100 text-slate-600"}`}>{CAT_LABEL[t.category] || t.category}</span></td>
                  <td className="p-3 font-semibold text-slate-800">
                    {t.partyId
                      ? <Link className="hover:text-primary" to={t.partyType === "CONTRACTOR" ? `/contractors/directory/${t.partyId}` : `/hr/employees/${t.partyId}`}>{t.party}</Link>
                      : t.party}
                  </td>
                  <td className="p-3 text-slate-500 truncate max-w-[220px]">{t.reference || "—"}</td>
                  <td className="p-3 text-right font-bold text-slate-900">{inr(t.amount)}</td>
                </tr>
              ))}
              {filteredTxns.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No payments recorded for this selection.</td></tr>
              )}
            </tbody>
            {filteredTxns.length > 0 && (
              <tfoot>
                <tr className="border-t bg-slate-50 font-bold text-slate-800">
                  <td className="p-3" colSpan={4}>Total</td>
                  <td className="p-3 text-right">{inr(filteredTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-400">
        <CircleHelp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          <b>Expenses</b> are real cost (salaries net of recoveries, bonuses paid, contractor payments).
          <b> Advances & loans are not expenses</b> — they’re cash lent to staff and recovered from future salary,
          so they sit under Recoverable / Owed to you. <b>Balances are scoped to the selected month</b> — payslips,
          advances/loans and contractor bills booked in that month that are still open, so they change as you switch months.
        </span>
      </p>
    </div>
  );
}

function HeadlineCard({ tone, icon, label, value, hint }: { tone: "rose" | "amber" | "cyan" | "emerald"; icon: React.ReactNode; label: string; value: string; hint?: string }) {
  const tones: Record<string, string> = {
    rose: "from-rose-50 to-white border-rose-200 text-rose-600",
    amber: "from-amber-50 to-white border-amber-200 text-amber-600",
    cyan: "from-cyan-50 to-white border-cyan-200 text-cyan-600",
    emerald: "from-emerald-50 to-white border-emerald-200 text-emerald-600",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide">{icon}{label}</div>
      <div className="mt-2 text-2xl md:text-3xl font-black text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function BreakdownCard({ title, note, rows, values, total, barBg, emptyText }: {
  title: string; note?: string; rows: Row[]; values: Record<string, any>; total: number; barBg: string; emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((r) => num(values[r.key])));
  const anything = rows.some((r) => num(values[r.key]) > 0);
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between mb-1 gap-3">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <span className="text-lg font-black text-slate-900 shrink-0">{inr(total)}</span>
      </div>
      {note && <p className="text-xs text-slate-400 mb-4">{note}</p>}
      {!anything ? (
        <p className="text-sm text-slate-400 py-6 text-center">{emptyText}</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const v = num(values[r.key]);
            const Icon = r.icon;
            const pct = Math.round((v / max) * 100);
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-slate-600"><Icon className={`w-4 h-4 ${r.tone}`} /> {r.label}</span>
                  <span className="font-bold text-slate-800">{inr(v)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${barBg}`} style={{ width: `${v > 0 ? Math.max(4, pct) : 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
