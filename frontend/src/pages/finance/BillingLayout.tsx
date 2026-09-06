import { NavLink, Outlet } from "react-router-dom";
import { ShoppingCart, FileText, Undo2 } from "lucide-react";

const TABS = [
  { to: "/billing/counter-sale", label: "Counter Sale", icon: ShoppingCart },
  { to: "/billing/invoices", label: "Invoices", icon: FileText },
  { to: "/billing/returns", label: "Product Return", icon: Undo2 },
];

export default function BillingLayout() {
  return (
    <div className="p-4 md:p-6 h-full flex flex-col bg-slate-50">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing</h1>
        <p className="text-sm text-muted-foreground">Counter sales, customer invoices and product returns.</p>
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
