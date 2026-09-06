import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Building2, BarChart3, PackageCheck,
} from "lucide-react";

const TABS = [
  { to: "/purchases", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/purchases/orders", label: "Orders", icon: ShoppingCart },
  { to: "/purchases/suppliers", label: "Suppliers", icon: Building2 },
  { to: "/purchases/receipt-log", label: "Receipt Log", icon: PackageCheck },
  { to: "/purchases/reports", label: "Reports", icon: BarChart3 },
];

export default function PurchaseLayout() {
  return (
    <div className="p-4 md:p-8 h-full flex flex-col bg-slate-50">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Purchasing</h1>
        <p className="text-muted-foreground mt-1">
          One order per purchase — items, goods received, payments and returns all live on the order.
          Build from low stock, receive &amp; pay in one place.
        </p>
      </div>

      <div className="flex gap-1 md:gap-2 mb-6 border-b overflow-x-auto shrink-0 pb-px">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 md:px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                isActive ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <Outlet />
      </div>
    </div>
  );
}
