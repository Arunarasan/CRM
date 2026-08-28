import { NavLink, Outlet } from "react-router-dom";
import { Users, BarChart3, HandCoins, CalendarClock, Palmtree, Building, Gauge, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Single "HR & Payroll" module home. Merges the old standalone /hr (Human Resources)
 * screen into the unified Workforce module: the directory + reports stay open to anyone
 * with WORKFORCE_READ, while the payroll / HR-admin tabs are gated behind PAYROLL_READ
 * (ROLE_ADMIN passes automatically via hasAuthority). UI gating is defense-in-depth only —
 * the backend @PreAuthorize checks remain the enforcement point.
 */
type Tab = { to: string; label: string; icon: typeof Users; end?: boolean };

const BASE_TABS: Tab[] = [
  { to: "/workforce", label: "Directory", icon: Users, end: true },
  { to: "/workforce/reports", label: "Reports", icon: BarChart3 },
];

const HR_TABS: Tab[] = [
  { to: "/workforce/payroll", label: "Payroll", icon: HandCoins },
  { to: "/workforce/cashflow", label: "Cashflow", icon: TrendingUp },
  { to: "/workforce/attendance", label: "Attendance", icon: CalendarClock },
  { to: "/workforce/leave", label: "Leave", icon: Palmtree },
  { to: "/workforce/departments", label: "Departments", icon: Building },
  { to: "/workforce/performance", label: "Performance", icon: Gauge },
];

export default function WorkforceLayout() {
  const { authorities, hasAuthority } = useAuth();
  // Older sessions may predate the userRoles localStorage entry — fall back to showing
  // everything rather than hiding the HR tabs (backend still enforces access).
  const legacySession = authorities.length === 0;
  const canSeeHr = legacySession || hasAuthority("PAYROLL_READ");

  const tabs = [...BASE_TABS.slice(0, 1), ...(canSeeHr ? HR_TABS : []), ...BASE_TABS.slice(1)];

  return (
    <div className="p-4 md:p-8 h-full flex flex-col bg-slate-50">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">HR &amp; Payroll</h1>
        <p className="text-muted-foreground mt-1">
          One home for everyone who does the work — employees and contractors in a single directory,
          with payroll, attendance, leave and performance all in one place.
        </p>
      </div>

      <div className="flex gap-1 md:gap-2 mb-6 border-b overflow-x-auto shrink-0 pb-px">
        {tabs.map(({ to, label, icon: Icon, end }) => (
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
