import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Wallet, BookOpen, Receipt, ArrowLeftRight, BarChart3, Plus, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TABS = [
  { to: "/finance", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/finance/cashbook", label: "Cash Book", icon: ArrowLeftRight },
  { to: "/finance/payments", label: "Payments", icon: Wallet },
  { to: "/finance/accounts", label: "Accounts", icon: BookOpen },
  { to: "/finance/expenses", label: "Expenses", icon: Receipt },
  { to: "/finance/reports", label: "Reports", icon: BarChart3 },
];

/** Finance shell: compact header with the everyday actions, then one tab bar covering every finance screen. */
export default function FinanceLayout() {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 h-full flex flex-col bg-slate-50">
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Money in, money out and what is still owed. Sales &amp; invoices live under Billing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/billing/invoices/new")}>
            <FileText className="h-4 w-4 mr-1" /> New invoice
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/finance/expenses")}>
            <Receipt className="h-4 w-4 mr-1" /> Add expense
          </Button>
          <Button size="sm" onClick={() => navigate("/finance/payments")}>
            <Plus className="h-4 w-4 mr-1" /> Record payment
          </Button>
        </div>
      </div>

      <nav aria-label="Finance sections" className="mb-4 flex shrink-0 gap-1 overflow-x-auto border-b pb-px">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 md:px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-t-md ${
                isActive ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto min-h-0 pb-8">
        <Outlet />
      </div>
    </div>
  );
}
