import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { financeApi } from "@/api/financeApi";
import type { FinanceDashboard as Dashboard, RecurringExpense } from "@/types/finance";
import { Badge } from "@/components/ui/badge";
import { currency, INVOICE_STATUS_TONE, INVOICE_STATUS_LABEL } from "./helpers";
import {
  AlertTriangle, BadgeCheck, CalendarClock, ChevronRight, Repeat,
  ArrowLeftRight, Wallet, Undo2, Users, Building2, Receipt, FileText, ShoppingCart, BarChart3,
  Percent, TrendingUp, Scale, ShoppingBag, type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";

/** Every finance function, grouped by the job the user is doing — the "where is X?" directory. */
const FUNCTION_GROUPS: { title: string; items: { label: string; hint: string; to: string; icon: LucideIcon }[] }[] = [
  {
    title: "Collect money",
    items: [
      { label: "Record payment", hint: "Customer receipts", to: "/finance/payments", icon: Wallet },
      { label: "Approve field payments", hint: "Collected by staff", to: "/finance/payments?tab=pending", icon: BadgeCheck },
      { label: "Refunds", hint: "Request, approve, pay", to: "/finance/payments?tab=refunds", icon: Undo2 },
    ],
  },
  {
    title: "Who owes what",
    items: [
      { label: "Customer ledger", hint: "Outstanding & statements", to: "/finance/accounts", icon: Users },
      { label: "Project profitability", hint: "Profit per project", to: "/finance/accounts?view=projects", icon: Building2 },
    ],
  },
  {
    title: "Money out",
    items: [
      { label: "Project expenses", hint: "Site & material costs", to: "/finance/expenses", icon: Receipt },
      { label: "Company expenses", hint: "Rent, power, hospitality", to: "/finance/expenses", icon: Receipt },
      { label: "Recurring bills", hint: "Due dates & reminders", to: "/finance/expenses", icon: Repeat },
    ],
  },
  {
    title: "Sales records",
    items: [
      { label: "Invoices", hint: "Issue, send, track", to: "/billing/invoices", icon: FileText },
      { label: "Counter sale", hint: "Walk-in billing", to: "/billing/counter-sale", icon: ShoppingCart },
      { label: "Product returns", hint: "Credit notes", to: "/billing/returns", icon: Undo2 },
    ],
  },
  {
    title: "Books & reports",
    items: [
      { label: "Cash book", hint: "Every inflow & outflow", to: "/finance/cashbook", icon: ArrowLeftRight },
      { label: "Revenue & expense", hint: "By period", to: "/finance/reports?r=revenue", icon: BarChart3 },
      { label: "Profit & loss", hint: "Net result", to: "/finance/reports?r=pnl", icon: TrendingUp },
      { label: "GST report", hint: "Tax summary", to: "/finance/reports?r=gst", icon: Percent },
      { label: "Cash flow", hint: "Month by month", to: "/finance/reports?r=cashflow", icon: Scale },
      { label: "Purchase vs sales", hint: "Buying against selling", to: "/finance/reports?r=pvs", icon: ShoppingBag },
    ],
  },
];

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading finance overview">
      <div className="h-24 rounded-2xl bg-slate-200/70" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-slate-200/70" />)}
      </div>
      <div className="h-72 rounded-2xl bg-slate-200/70" />
    </div>
  );
}

function Stat({ label, value, to, tone = "text-slate-900" }: { label: string; value: string | number; to: string; tone?: string }) {
  return (
    <Link to={to} className="group block rounded-lg px-2 py-1.5 -mx-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`text-lg md:text-xl font-bold tabular-nums ${tone}`}>{value}</div>
    </Link>
  );
}

export default function FinanceDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [bills, setBills] = useState<RecurringExpense[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    financeApi.getDashboard().then(setData).catch((e) => {
      console.error(e);
      setError("Could not load the finance overview. Your data has not changed.");
    });
    financeApi.getRecurringExpenses(true).then(setBills).catch(() => {});
  };
  useEffect(load, []);

  if (error) {
    return (
      <div className="bg-white border rounded-2xl p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={load} className="mt-3 text-sm font-semibold text-primary hover:underline">Try again</button>
      </div>
    );
  }
  if (!data) return <Skeleton />;

  const overdueBills = bills.filter((b) => b.dueStatus === "OVERDUE");
  const soonBills = bills.filter((b) => b.dueStatus === "DUE_SOON");
  const attention: { text: string; to: string; tone: string; icon: LucideIcon }[] = [];
  if (data.pendingApprovalPayments > 0) attention.push({
    text: `${data.pendingApprovalPayments} field-collected payment${data.pendingApprovalPayments > 1 ? "s" : ""} awaiting approval`,
    to: "/finance/payments?tab=pending", tone: "bg-amber-50 border-amber-200 text-amber-800", icon: BadgeCheck,
  });
  if (data.overdueAmount > 0) attention.push({
    text: `${currency(data.overdueAmount)} overdue from customers`,
    to: "/finance/accounts", tone: "bg-red-50 border-red-200 text-red-800", icon: AlertTriangle,
  });
  if (overdueBills.length > 0) attention.push({
    text: `${overdueBills.length} recurring bill${overdueBills.length > 1 ? "s" : ""} overdue: ${overdueBills.slice(0, 2).map((b) => b.name).join(", ")}`,
    to: "/finance/expenses", tone: "bg-red-50 border-red-200 text-red-800", icon: Repeat,
  });

  const profitPositive = data.monthProfit >= 0;

  return (
    <div className="space-y-5">
      {attention.length > 0 && (
        <section aria-label="Needs attention" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {attention.map((a) => (
            <Link key={a.text} to={a.to} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${a.tone}`}>
              <a.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 min-w-0">{a.text}</span>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
            </Link>
          ))}
        </section>
      )}

      {/* The month at a glance: result first, then the three groups that explain it. */}
      <section aria-label="This month" className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Link to="/finance/reports?r=pnl" className="lg:col-span-1 rounded-2xl border bg-white p-5 shadow-sm hover:shadow transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profit this month</div>
          <div className={`mt-1 text-3xl font-bold tabular-nums ${profitPositive ? "text-emerald-700" : "text-red-600"}`}>
            {currency(data.monthProfit)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {currency(data.monthRevenue)} invoiced − {currency(data.monthExpenses)} expenses
          </div>
        </Link>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">Money in</h3>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-x-4">
              <Stat label="Collected today" value={currency(data.todaysCollection)} to="/finance/payments" />
              <Stat label="Collected this month" value={currency(data.monthCollection)} to="/finance/payments" />
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Still owed</h3>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-x-4">
              <Stat label="Total outstanding" value={currency(data.totalOutstanding)} to="/finance/accounts" />
              <Stat label={`Overdue · ${data.pendingInvoices} open invoice${data.pendingInvoices === 1 ? "" : "s"}`}
                value={currency(data.overdueAmount)} to="/finance/accounts" tone={data.overdueAmount > 0 ? "text-red-600" : "text-slate-900"} />
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2">Money out</h3>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-x-4">
              <Stat label="Expenses this month" value={currency(data.monthExpenses)} to="/finance/expenses" />
              <Stat label={soonBills.length ? `Recurring bills due within 7 days` : "Recurring bills due soon"}
                value={soonBills.length} to="/finance/expenses" tone={soonBills.length ? "text-amber-700" : "text-slate-900"} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white border rounded-2xl shadow-sm p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Cash flow · last 6 months</h3>
          {data.cashFlow.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No cash movement recorded yet.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => currency(Number(v))} />
                  <Legend />
                  <Bar dataKey="moneyIn" name="Money in" fill="#2F8F65" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="moneyOut" name="Money out" fill="#B94A48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-sm">Coming up</h3>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {[...overdueBills, ...soonBills].map((b) => (
              <Link key={`b${b.id}`} to="/finance/expenses" className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-800 truncate">{b.name}</div>
                  <div className="text-xs text-muted-foreground">Bill to pay · {b.nextDueDate}</div>
                </div>
                <Badge className={b.dueStatus === "OVERDUE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                  {b.dueStatus === "OVERDUE" ? `Overdue ${-(b.daysUntilDue ?? 0)}d` : (b.daysUntilDue ?? 0) <= 0 ? "Today" : `In ${b.daysUntilDue}d`}
                </Badge>
              </Link>
            ))}
            {data.upcomingDues.map((d) => (
              <Link key={`i${d.invoiceId}`} to={`/billing/invoices/${d.invoiceId}`} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-800 truncate">{d.invoiceNumber} · {d.customerName}</div>
                  <div className="text-xs text-muted-foreground">To collect · due {d.dueDate}</div>
                </div>
                <span className="text-sm font-bold text-amber-600 tabular-nums">{currency(d.balanceDue)}</span>
              </Link>
            ))}
            {overdueBills.length + soonBills.length + data.upcomingDues.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Nothing to pay or collect in the next 7 days.</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Recent payments</h3>
            <Link to="/finance/payments" className="text-xs font-semibold text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {data.recentPayments.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-800">{p.paymentNumber}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.customer?.name} · {p.paymentDate}</div>
                </div>
                <span className="text-sm font-bold text-emerald-600 tabular-nums">{currency(p.amount)}</span>
              </div>
            ))}
            {data.recentPayments.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No payments recorded yet. <Link to="/finance/payments" className="font-semibold text-primary hover:underline">Record the first payment</Link>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Recent invoices</h3>
            <Link to="/billing/invoices" className="text-xs font-semibold text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {data.recentInvoices.map((i) => (
              <Link key={i.id} to={`/billing/invoices/${i.id}`} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-800">{i.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground truncate">{i.customer?.name} · {currency(i.totalAmount)}</div>
                </div>
                <Badge className={INVOICE_STATUS_TONE[i.status]}>{INVOICE_STATUS_LABEL[i.status]}</Badge>
              </Link>
            ))}
            {data.recentInvoices.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No invoices yet. <Link to="/billing/invoices/new" className="font-semibold text-primary hover:underline">Create an invoice</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-label="All finance functions">
        <h3 className="font-bold text-slate-800 text-sm mb-3">Everything in Finance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {FUNCTION_GROUPS.map((g) => (
            <div key={g.title} className="bg-white border rounded-2xl shadow-sm p-3">
              <div className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.title}</div>
              {g.items.map((it) => (
                <Link key={it.label} to={it.to} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <it.icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">{it.label}</span>
                    <span className="block text-xs text-muted-foreground truncate">{it.hint}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
