import { NavLink, Outlet } from "react-router-dom";
import { Users, BarChart3 } from "lucide-react";

const TABS = [
  { to: "/workforce", label: "Directory", icon: Users, end: true },
  { to: "/workforce/reports", label: "Reports", icon: BarChart3 },
];

export default function WorkforceLayout() {
  return (
    <div className="p-4 md:p-8 h-full flex flex-col bg-slate-50">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Workforce Management</h1>
        <p className="text-muted-foreground mt-1">
          One directory for everyone who does the work — employees and contractors created through a
          single flow, with payroll and contract payments kept in their own modules.
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
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <Outlet />
      </div>
    </div>
  );
}
