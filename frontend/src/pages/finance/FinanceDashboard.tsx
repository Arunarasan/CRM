import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { financeApi } from "@/api/financeApi";
import type { FinanceDashboard as Dashboard } from "@/types/finance";
import { Badge } from "@/components/ui/badge";
import { currency, INVOICE_STATUS_TONE, INVOICE_STATUS_LABEL } from "./helpers";
import {
  Wallet, TrendingUp, AlertCircle, FileText, Receipt, PiggyBank, CalendarClock, BadgeCheck,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";

export default function FinanceDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    financeApi.getDashboard().then(setData).catch((e) => {
      console.error(e);
      setError("Could not load the finance dashboard.");
    });
  }, []);

  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading finance dashboard…</div>;

  const tiles = [
    { label: "Today's Collection", value: currency(data.todaysCollection), icon: Wallet, tone: "bg-emerald-50 text-emerald-600", to: "/finance/payments" },
    { label: "Monthly Revenue (Invoiced)", value: currency(data.monthRevenue), icon: TrendingUp, tone: "bg-blue-50 text-blue-600", to: "/finance/invoices" },
    { label: "Monthly Collection", value: currency(data.monthCollection), icon: PiggyBank, tone: "bg-cyan-50 text-cyan-600", to: "/finance/payments" },
    { label: "Total Outstanding", value: currency(data.totalOutstanding), icon: AlertCircle, tone: "bg-amber-50 text-amber-600", to: "/finance/outstanding" },
    { label: "Overdue Amount", value: currency(data.overdueAmount), icon: AlertCircle, tone: "bg-red-50 text-red-600", to: "/finance/outstanding" },
    { label: "Pending Invoices", value: data.pendingInvoices, icon: FileText, tone: "bg-indigo-50 text-indigo-600", to: "/finance/invoices" },
    { label: "Monthly Expenses", value: currency(data.monthExpenses), icon: Receipt, tone: "bg-rose-50 text-rose-600", to: "/finance/expenses" },
    { label: "Monthly Profit", value: currency(data.monthProfit), icon: TrendingUp, tone: data.monthProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600", to: "/finance/profitability" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${t.tone}`}>
              <t.icon className="w-5 h-5" />
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-900">{t.value}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1">{t.label}</div>
          </Link>
        ))}
      </div>

      {data.pendingApprovalPayments > 0 && (
        <Link to="/finance/payments?tab=pending" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:bg-amber-100 transition-colors">
          <BadgeCheck className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">
            {data.pendingApprovalPayments} field-collected payment{data.pendingApprovalPayments > 1 ? "s" : ""} awaiting approval
          </span>
        </Link>
      )}

      <div className="bg-white border rounded-2xl shadow-sm p-4">
        <h3 className="font-bold text-slate-800 text-sm mb-4">Cash Flow (last 6 months)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.cashFlow}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => currency(Number(v))} />
              <Legend />
              <Bar dataKey="moneyIn" name="Money In" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="moneyOut" name="Money Out" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-sm">Upcoming Dues (7 days)</h3>
          </div>
          <div className="divide-y">
            {data.upcomingDues.map((d) => (
              <Link key={d.invoiceId} to={`/finance/invoices/${d.invoiceId}`} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-sm text-slate-800">{d.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">{d.customerName} · due {d.dueDate}</div>
                </div>
                <span className="text-sm font-bold text-amber-600">{currency(d.balanceDue)}</span>
              </Link>
            ))}
            {data.upcomingDues.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Nothing due in the next 7 days.</div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm">Recent Payments</h3>
          </div>
          <div className="divide-y">
            {data.recentPayments.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-800">{p.paymentNumber}</div>
                  <div className="text-xs text-muted-foreground">{p.customer?.name} · {p.paymentDate}</div>
                </div>
                <span className="text-sm font-bold text-emerald-600">{currency(p.amount)}</span>
              </div>
            ))}
            {data.recentPayments.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No payments recorded yet.</div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm">Recent Invoices</h3>
          </div>
          <div className="divide-y">
            {data.recentInvoices.map((i) => (
              <Link key={i.id} to={`/finance/invoices/${i.id}`} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-sm text-slate-800">{i.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">{i.customer?.name} · {currency(i.totalAmount)}</div>
                </div>
                <Badge className={INVOICE_STATUS_TONE[i.status]}>{INVOICE_STATUS_LABEL[i.status]}</Badge>
              </Link>
            ))}
            {data.recentInvoices.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No invoices yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
