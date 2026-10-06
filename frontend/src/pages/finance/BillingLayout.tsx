import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ShoppingCart, FileText, Undo2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const TABS = [
  { to: "/billing/counter-sale", label: "Counter Sale", icon: ShoppingCart },
  { to: "/billing/invoices", label: "Invoices", icon: FileText },
  { to: "/billing/returns", label: "Product Returns", icon: Undo2 },
];

/** Billing: Counter Sale / Invoices / Returns tabs straight away — no page title, so the work gets the space. */
export default function BillingLayout() {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 h-full flex flex-col bg-slate-50">
      <div className="mb-4 flex shrink-0 items-center gap-2 border-b">
        <div className="flex flex-1 gap-1 md:gap-2 overflow-x-auto pb-px">
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
        <Button size="sm" variant="outline" onClick={() => navigate("/billing/invoices/new")} className="mb-1.5 shrink-0 active:scale-[0.98]">
          <Plus className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">New invoice</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
