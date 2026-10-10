import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Users, BarChart3, HandCoins, CalendarClock, Palmtree, Building, Gauge, TrendingUp, ShieldCheck,
  ClipboardList, Award, LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";

/**
 * Single "HR & Payroll" module home. The directory + reports stay open to anyone with
 * WORKFORCE_READ, while the HR-admin pages are gated behind PAYROLL_READ (ROLE_ADMIN passes
 * automatically via hasAuthority). UI gating is defense-in-depth only — the backend
 * @PreAuthorize checks remain the enforcement point.
 *
 * Navigation shows every page at once, grouped: a side menu on wide screens, one scrollable
 * row on phones/tablets. Badges show what's waiting for HR (from GET /hr/overview).
 */
type Item = { to: string; label: string; icon: typeof Users; end?: boolean; hr?: boolean; badge?: keyof Waiting };
type Group = { label?: string; items: Item[] };
export type Waiting = {
  punches?: number; corrections?: number; leave?: number; profileChanges?: number;
  dailyReports?: number; moneyRequests?: number; bonuses?: number;
  attendance?: number; payroll?: number;
};

const GROUPS: Group[] = [
  { items: [{ to: "/workforce", label: "Home", icon: LayoutDashboard, end: true, hr: true }] },
  {
    label: "People", items: [
      { to: "/workforce/people", label: "Directory", icon: Users },
      { to: "/workforce/approvals", label: "Profile changes", icon: ShieldCheck, hr: true, badge: "profileChanges" },
      { to: "/workforce/daily-reports", label: "Daily reports", icon: ClipboardList, hr: true, badge: "dailyReports" },
    ],
  },
  {
    label: "Time", items: [
      { to: "/workforce/attendance", label: "Attendance", icon: CalendarClock, hr: true, badge: "attendance" },
      { to: "/workforce/leave", label: "Leave", icon: Palmtree, hr: true, badge: "leave" },
    ],
  },
  {
    label: "Pay", items: [
      { to: "/workforce/payroll", label: "Payroll", icon: HandCoins, hr: true, badge: "payroll" },
      { to: "/workforce/cashflow", label: "Cashflow", icon: TrendingUp, hr: true },
    ],
  },
  {
    label: "Performance", items: [
      { to: "/workforce/performance", label: "Scores", icon: Gauge, hr: true },
      { to: "/workforce/review-rewards", label: "Review rewards", icon: Award, hr: true },
    ],
  },
  {
    label: "Organisation", items: [
      { to: "/workforce/departments", label: "Departments", icon: Building, hr: true },
      { to: "/workforce/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

/** Waiting-for-HR counts for the nav badges, refreshed on navigation (cheap, read-only). */
function useWaiting(enabled: boolean, pathname: string): Waiting {
  const [w, setW] = useState<Waiting>({});
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api.get("/hr/overview").then((r) => {
      if (!alive) return;
      const x = r.data?.waiting ?? {};
      const p = r.data?.payroll ?? {};
      setW({
        ...x,
        attendance: Number(x.punches || 0) + Number(x.corrections || 0),
        payroll: Number(x.moneyRequests || 0) + Number(x.bonuses || 0) + Number(p.toApprove || 0),
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, [enabled, pathname]);
  return w;
}

export default function WorkforceLayout() {
  const { pathname } = useLocation();
  const { authorities, hasAuthority } = useAuth();
  // Older sessions may predate the userRoles localStorage entry — fall back to showing
  // everything rather than hiding the HR pages (backend still enforces access).
  const legacySession = authorities.length === 0;
  const canSeeHr = legacySession || hasAuthority("PAYROLL_READ");
  const waiting = useWaiting(canSeeHr, pathname);

  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((t) => canSeeHr || !t.hr) }))
    .filter((g) => g.items.length > 0);

  const badge = (it: Item) => {
    const n = it.badge ? Number(waiting[it.badge] || 0) : 0;
    return n > 0
      ? <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-800">{n}</span>
      : null;
  };
  const linkCls = (isActive: boolean) => isActive
    ? "bg-primary/10 font-semibold text-primary"
    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

  return (
    <div className="flex h-full flex-col bg-slate-50 p-4 md:p-6 lg:p-8">
      <h1 className="mb-3 shrink-0 text-xl font-semibold tracking-tight text-slate-900 md:mb-4 md:text-2xl">HR &amp; Payroll</h1>

      {/* Phones / tablets — every page in one scrollable row */}
      <nav className="-mx-4 mb-4 shrink-0 overflow-x-auto border-b px-4 md:mx-0 md:px-0 2xl:hidden" aria-label="HR & Payroll pages">
        <div className="flex w-max items-center gap-1 pb-2">
          {groups.map((g, gi) => (
            <div key={gi} className="flex items-center gap-1">
              {gi > 0 && <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />}
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end}
                  className={({ isActive }) => `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors ${linkCls(isActive)}`}>
                  <it.icon className="h-4 w-4" /> {it.label} {badge(it)}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <div className="flex min-h-0 flex-1 gap-6">
        {/* Wide screens — grouped side menu, all pages visible */}
        <nav className="hidden w-52 shrink-0 overflow-y-auto 2xl:block" aria-label="HR & Payroll pages">
          <div className="space-y-4">
            {groups.map((g, gi) => (
              <div key={gi}>
                {g.label && <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</div>}
                <ul className="space-y-0.5">
                  {g.items.map((it) => (
                    <li key={it.to}>
                      <NavLink to={it.to} end={it.end}
                        className={({ isActive }) => `flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${linkCls(isActive)}`}>
                        <it.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{it.label}</span> {badge(it)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Gutter lives on this scroller (not the page) so chip rows can bleed edge-to-edge on phones without a sideways scroll. */}
        <div className="-mx-4 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 md:mx-0 md:px-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
