import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ShoppingCart, FileText, Undo2, Plus } from "lucide-react";
import { financeApi } from "@/api/financeApi";
import type { FinanceDashboard } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { inr } from "@/components/billing/billing-ui";

const TABS = [
  { to: "/billing/counter-sale", label: "Counter Sale", icon: ShoppingCart },
  { to: "/billing/invoices", label: "Invoices", icon: FileText },
  { to: "/billing/returns", label: "Product Returns", icon: Undo2 },
];

/** Billing: the money still to collect at a glance, then Counter Sale / Invoices / Returns. */
export default function BillingLayout() {
  const navigate = useNavigate();
  const [dash, setDash] = useState<FinanceDashboard | null>(null);
  useEffect(() => { financeApi.getDashboard().then(setDash).catch(() => setDash(null)); }, []);

  const figures: { label: string; value: number | undefined; sub?: string; tone: string; to?: string }[] = [
    { label: "To collect", value: dash?.totalOutstanding, sub: dash ? `${dash.pendingInvoices} open invoice${dash.pendingInvoices === 1 ? "" : "s"}` : undefined, tone: "text-slate-900", to: "/billing/invoices?status=UNPAID" },
    { label: "Overdue", value: dash?.overdueAmount, sub: "past the due date", tone: Number(dash?.overdueAmount) > 0 ? "text-rose-600" : "text-slate-900", to: "/billing/invoices?status=OVERDUE" },
    { label: "Collected this month", value: dash?.monthCollection, tone: "text-emerald-700" },
    { label: "Collected today", value: dash?.todaysCollection, tone: "text-emerald-700" },
  ];

  return (
    <div className="p-4 md:p-6 h-full flex flex-col bg-slate-50">
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing</h1>
          <p className="text-sm text-muted-foreground">Counter sales, customer invoices and product returns.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/billing/invoices/new")} className="active:scale-[0.98]">
          <Plus className="mr-1.5 h-4 w-4" /> New invoice
        </Button>
      </div>

      {/* Summary — one strip, not four floating cards */}
      <div className="mb-4 grid shrink-0 grid-cols-2 divide-slate-100 overflow-hidden rounded-2xl border bg-white shadow-sm md:grid-cols-4 md:divide-x">
        {figures.map((f) => {
          const body = (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</div>
              {dash ? (
                <div className={`mt-1 text-xl font-black tabular-nums tracking-tight ${f.tone}`}>{inr(f.value)}</div>
              ) : (
                <div className="mt-1.5 h-6 w-24 animate-pulse rounded bg-slate-100" />
              )}
              {f.sub && dash && <div className="text-[11px] text-slate-400">{f.sub}</div>}
            </>
          );
          return f.to ? (
            <button key={f.label} type="button" onClick={() => navigate(f.to!)}
              className="px-4 py-3 text-left transition-colors hover:bg-slate-50 active:scale-[0.99]">{body}</button>
          ) : (
            <div key={f.label} className="px-4 py-3">{body}</div>
          );
        })}
      </div>

      <div className="flex gap-1 md:gap-2 mb-4 border-b overflow-x-auto shrink-0 pb-px">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 md:px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                isActive ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
