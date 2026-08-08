import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, PackageOpen, Boxes, HardHat,
  ShieldCheck, Receipt, Wallet, BookOpen, BarChart3,
} from "lucide-react";

const TABS = [
  { to: "/contractors", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/contractors/directory", label: "Contractors", icon: Users },
  { to: "/contractors/work-packages", label: "Work Packages", icon: PackageOpen },
  { to: "/contractors/materials", label: "Materials", icon: Boxes },
  { to: "/contractors/progress", label: "Progress", icon: HardHat },
  { to: "/contractors/quality", label: "Quality", icon: ShieldCheck },
  { to: "/contractors/bills", label: "Bills", icon: Receipt },
  { to: "/contractors/payments", label: "Payments", icon: Wallet },
  { to: "/contractors/ledger", label: "Ledger", icon: BookOpen },
  { to: "/contractors/reports", label: "Reports", icon: BarChart3 },
];

export default function ContractorLayout() {
  return (
    <div className="p-4 md:p-8 h-full flex flex-col bg-slate-50">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Contractor Management</h1>
        <p className="text-muted-foreground mt-1">
          Subcontractor execution inside project delivery — work packages carved from the BOQ, assigned,
          executed, inspected, billed and paid.
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
