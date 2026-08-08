import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Boxes, Warehouse, ArrowLeftRight,
  Send, ClipboardList, AlertTriangle, ShoppingCart,
} from "lucide-react";

const TABS = [
  { to: "/inventory", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/inventory/materials", label: "Material Master", icon: Boxes },
  { to: "/inventory/warehouses", label: "Warehouses", icon: Warehouse },
  { to: "/inventory/stock-movement", label: "Stock Movement", icon: ArrowLeftRight },
  { to: "/inventory/transfers", label: "Transfers", icon: Send },
  { to: "/inventory/material-requests", label: "Material Requests", icon: ClipboardList },
  { to: "/inventory/damage", label: "Damage Entries", icon: AlertTriangle },
  { to: "/inventory/purchase-requests", label: "Purchase Requests", icon: ShoppingCart },
];

export default function InventoryLayout() {
  return (
    <div className="p-4 md:p-8 h-full flex flex-col bg-slate-50">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Inventory</h1>
        <p className="text-muted-foreground mt-1">
          Material master, warehouse stock, movements, transfers, requests and audit — the central
          stock system feeding projects and purchasing.
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
