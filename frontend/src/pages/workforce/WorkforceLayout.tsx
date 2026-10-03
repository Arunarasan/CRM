import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Users, BarChart3, HandCoins, CalendarClock, Palmtree, Building, Gauge, TrendingUp, ShieldCheck,
  ClipboardList, Award, Wallet, Clock3, Network, Star,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Single "HR & Payroll" module home. Merges the old standalone /hr (Human Resources)
 * screen into the unified Workforce module: the directory + reports stay open to anyone
 * with WORKFORCE_READ, while the payroll / HR-admin tabs are gated behind PAYROLL_READ
 * (ROLE_ADMIN passes automatically via hasAuthority). UI gating is defense-in-depth only —
 * the backend @PreAuthorize checks remain the enforcement point.
 *
 * Navigation is two-level so eleven sections fit on a phone: a row of groups
 * (People · Time · Pay · Performance · Organisation), then the pages inside the active group.
 */
type Tab = { to: string; label: string; icon: typeof Users; end?: boolean; hr?: boolean };
type Group = { key: string; label: string; short?: string; icon: typeof Users; tabs: Tab[] };

const GROUPS: Group[] = [
  {
    key: "people", label: "People", icon: Users, tabs: [
      { to: "/workforce", label: "Directory", icon: Users, end: true },
      { to: "/workforce/approvals", label: "Approvals", icon: ShieldCheck, hr: true },
      { to: "/workforce/daily-reports", label: "Daily reports", icon: ClipboardList, hr: true },
    ],
  },
  {
    key: "time", label: "Time", icon: Clock3, tabs: [
      { to: "/workforce/attendance", label: "Attendance", icon: CalendarClock, hr: true },
      { to: "/workforce/leave", label: "Leave", icon: Palmtree, hr: true },
    ],
  },
  {
    key: "pay", label: "Pay", icon: Wallet, tabs: [
      { to: "/workforce/payroll", label: "Payroll", icon: HandCoins, hr: true },
      { to: "/workforce/cashflow", label: "Cashflow", icon: TrendingUp, hr: true },
    ],
  },
  {
    key: "performance", label: "Performance", short: "Scores", icon: Star, tabs: [
      { to: "/workforce/performance", label: "Scores", icon: Gauge, hr: true },
      { to: "/workforce/review-rewards", label: "Review rewards", icon: Award, hr: true },
    ],
  },
  {
    key: "org", label: "Organisation", short: "Org", icon: Network, tabs: [
      { to: "/workforce/departments", label: "Departments", icon: Building, hr: true },
      { to: "/workforce/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

const matches = (tab: Tab, path: string) =>
  tab.end ? path === tab.to || path === `${tab.to}/` : path === tab.to || path.startsWith(`${tab.to}/`);

export default function WorkforceLayout() {
  const { pathname } = useLocation();
  const { authorities, hasAuthority } = useAuth();
  // Older sessions may predate the userRoles localStorage entry — fall back to showing
  // everything rather than hiding the HR tabs (backend still enforces access).
  const legacySession = authorities.length === 0;
  const canSeeHr = legacySession || hasAuthority("PAYROLL_READ");

  const groups = GROUPS
    .map((g) => ({ ...g, tabs: g.tabs.filter((t) => canSeeHr || !t.hr) }))
    .filter((g) => g.tabs.length > 0);
  const active = groups.find((g) => g.tabs.some((t) => matches(t, pathname))) ?? groups[0];

  return (
    <div className="flex h-full flex-col bg-slate-50 p-4 md:p-6 lg:p-8">
      <header className="mb-4 shrink-0 md:mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">HR &amp; Payroll</h1>
        <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
          Employees and contractors, their time, pay and performance — in one place.
        </p>
      </header>

      <nav className="mb-5 shrink-0 space-y-3" aria-label="HR & Payroll sections">
        {/* Level 1 — groups. Equal-width segments on phones, natural width from tablet up. */}
        <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border bg-card p-1 shadow-sm sm:inline-grid sm:auto-cols-auto">
          {groups.map((g) => {
            const on = g.key === active.key;
            const Icon = g.icon;
            return (
              <NavLink key={g.key} to={g.tabs[0].to} end={g.tabs[0].end}
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors sm:flex-row sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
                  on ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-w-full truncate sm:hidden">{g.short ?? g.label}</span>
                <span className="hidden sm:inline">{g.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Level 2 — pages inside the active group (hidden when the group has only one). */}
        {active.tabs.length > 1 && (
          <div className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
            <div className="flex w-max gap-1">
              {active.tabs.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) =>
                    `-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2.5 sm:gap-2 sm:px-3 text-sm font-medium transition-colors ${
                      isActive ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Gutter lives on this scroller (not the page) so chip rows can bleed edge-to-edge on phones without a sideways scroll. */}
      <div className="-mx-4 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 md:mx-0 md:px-0">
        <Outlet />
      </div>
    </div>
  );
}
