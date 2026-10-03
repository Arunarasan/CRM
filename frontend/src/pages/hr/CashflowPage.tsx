import { useEffect, useMemo, useState } from "react";
import { payrollApi } from "@/api/payrollApi";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import { CardStat, FilterChips, PeriodPicker, PersonChip, SectionHeader, StatTile } from "@/pages/workforce/hrUi";
import { format } from "date-fns";
import {
  BadgeIndianRupee, HandCoins, Wallet, Landmark, Gift, HardHat,
  TrendingDown, CircleHelp, RotateCcw, Receipt,
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

  const txnCols: Column<any>[] = [
    { key: "date", header: "Date", cellClassName: "whitespace-nowrap text-slate-600", cell: (t) => fmtDate(t.date) },
    { key: "cat", header: "Category", cell: (t) => <CatTag c={t.category} /> },
    { key: "party", header: "Paid to", cell: (t) => <Party t={t} /> },
    { key: "ref", header: "Reference", cell: (t) => <span className="block max-w-[220px] truncate text-slate-500">{t.reference || "—"}</span> },
    { key: "amt", header: "Amount", headClassName: "text-right", cellClassName: "text-right font-semibold tabular-nums text-slate-900", cell: (t) => inr(t.amount) },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Workforce cashflow"
        description="Real cost vs recoverable cash out, and what you owe vs what's coming back."
        actions={<PeriodPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />}
      />

      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total expense" value={inr(expenseTotal)} hint="real cost this month" tone={expenseTotal > 0 ? "danger" : "neutral"} />
        <StatTile label="Recoverable out" value={inr(recoverableTotal)} hint="advances & loans" tone="info" />
        <StatTile label="You owe" value={inr(payableTotal)} hint="still to pay" tone={payableTotal > 0 ? "warning" : "neutral"} />
        <StatTile label="Owed to you" value={inr(receivableTotal)} hint="to recover" tone="success" />
      </div>

      {loading && <div className="text-sm text-slate-400">Loading cashflow…</div>}

      {/* MONEY OUT — expense vs recoverable */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <TrendingDown className="w-4 h-4" /> Money out — {MONTHS[month - 1]} {year}
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BreakdownCard title="Expenses (real cost)" note="Actual cost to the company — never recovered." rows={EXPENSE_ROWS} values={paid} total={expenseTotal} barBg="bg-rose-500/80" emptyText="No expenses this month." />
          <BreakdownCard title="Recoverable (not an expense)" note="Cash lent to staff — recovered from future salary." rows={RECOVERABLE_ROWS} values={paid} total={recoverableTotal} barBg="bg-cyan-500/80" emptyText="No advances or loans disbursed this month." />
        </div>
      </div>

      {/* MONEY IN — recoveries from staff */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <RotateCcw className="w-4 h-4" /> Money in — {MONTHS[month - 1]} {year}
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BreakdownCard title="Recovered (money in)" note="Advances & loans recovered from the salaries paid this month." rows={MONEYIN_ROWS} values={moneyIn} total={moneyInTotal} barBg="bg-emerald-500/80" emptyText="Nothing recovered this month." />
          <div className="flex flex-col justify-center rounded-xl border bg-card p-4 shadow-sm md:p-5">
            <h3 className="font-bold text-slate-800 mb-3">Net cash movement</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-500">Money out (expense + recoverable)</span><span className="font-semibold text-rose-600">− {inr(moneyOutTotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Money in (recovery)</span><span className="font-semibold text-emerald-600">+ {inr(moneyInTotal)}</span></div>
              <div className="flex items-center justify-between border-t pt-2 mt-1"><span className="font-bold text-slate-800">Net cash out</span><span className="text-xl font-semibold tabular-nums text-slate-900">{inr(netCashOut)}</span></div>
            </div>
            <p className="text-xs text-slate-400 mt-3">Actual cash that left the bank this month, after recoveries came back.</p>
          </div>
        </div>
      </div>

      {/* BALANCES — payables vs receivables (month-scoped) */}
      <div>
        <h3 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
          <BadgeIndianRupee className="w-4 h-4" /> Balances — {MONTHS[month - 1]} {year}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">still open, booked this month</span>
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BreakdownCard title="You owe (payables)" note="Unpaid payslips & contractor bills booked this month." rows={PAYABLE_ROWS} values={owed} total={payableTotal} barBg="bg-amber-500/80" emptyText="You owe nothing for this month." />
          <BreakdownCard title="Owed to you (receivables)" note="Advances/loans given this month, still to recover." rows={RECEIVABLE_ROWS} values={owed} total={receivableTotal} barBg="bg-emerald-500/80" emptyText="Nothing to recover from this month." />
        </div>
      </div>

      {/* detail list — every payment made this month */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Payments made — {MONTHS[month - 1]} {year}</h3>
            <p className="text-xs text-slate-500">{filteredTxns.length} payment{filteredTxns.length === 1 ? "" : "s"} · {inr(filteredTotal)}</p>
          </div>
          <FilterChips options={CAT_FILTERS.map((c) => ({ key: c, label: c === "ALL" ? "All" : CAT_LABEL[c] }))} value={catFilter} onChange={setCatFilter} />
        </div>
        <ResponsiveList
          items={filteredTxns}
          columns={txnCols}
          getRowKey={(t: any) => `${t.category}-${t.date}-${t.partyId ?? t.party}-${t.reference ?? ""}-${t.amount}`}
          loading={loading}
          emptyIcon={Receipt}
          emptyTitle="No payments recorded for this selection"
          renderCard={(t: any) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Party t={t} />
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">{inr(t.amount)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CatTag c={t.category} /> <span>{fmtDate(t.date)}</span>
                {t.reference && <span className="truncate">· {t.reference}</span>}
              </div>
            </div>
          )}
        />
        {filteredTxns.length > 0 && (
          <div className="flex justify-end">
            <CardStat label="Total" value={inr(filteredTotal)} className="text-right font-semibold" />
          </div>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-500">
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

function CatTag({ c }: { c: string }) {
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${CAT_TONE[c] || "bg-slate-100 text-slate-600"}`}>{CAT_LABEL[c] || c}</span>;
}

function Party({ t }: { t: any }) {
  const to = t.partyId ? (t.partyType === "CONTRACTOR" ? `/contractors/directory/${t.partyId}` : `/hr/employees/${t.partyId}`) : undefined;
  return <PersonChip name={t.party} to={to} size="sm" tone={t.partyType === "CONTRACTOR" ? "contractor" : "employee"} />;
}

function BreakdownCard({ title, note, rows, values, total, barBg, emptyText }: {
  title: string; note?: string; rows: Row[]; values: Record<string, any>; total: number; barBg: string; emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((r) => num(values[r.key])));
  const anything = rows.some((r) => num(values[r.key]) > 0);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-start justify-between mb-1 gap-3">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <span className="shrink-0 text-lg font-semibold tabular-nums text-slate-900">{inr(total)}</span>
      </div>
      {note && <p className="mb-4 text-xs text-slate-500">{note}</p>}
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
