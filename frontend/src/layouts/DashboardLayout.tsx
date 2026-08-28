import { useState, useEffect } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import {
  Bell, LogOut, Menu, X, LayoutDashboard, Users, Target, FolderKanban, ChevronLeft,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

/**
 * Sidebar entries gated by the authority needed to actually use the module (matching the
 * backend's @PreAuthorize checks). `authority: null` means visible to every logged-in user.
 * UI-level defense-in-depth only — the backend remains the enforcement point.
 */
const NAV_ITEMS: { to: string; label: string; authority: string | null; adminOnly?: boolean; underMaintenance?: boolean }[] = [
  { to: "/dashboard", label: "Dashboard", authority: null },
  { to: "/customers", label: "Customers", authority: "CUSTOMER_READ" },
  { to: "/leads", label: "Leads", authority: "LEAD_READ" },
  // Site Visits, Measurements, BOQ and Quotations are no longer standalone modules — the whole
  // pre-sale pipeline is driven from the Lead's Sales Journey (and post-sale from the Project),
  // so none of them get a sidebar entry. Their routes stay alive for in-lead links / deep links.
  { to: "/projects", label: "Projects", authority: "PROJECT_READ" },
  { to: "/tasks", label: "Tasks & Workforce", authority: "TASK_READ" },
  { to: "/inventory", label: "Inventory", authority: "INVENTORY_READ" },
  { to: "/purchases", label: "Purchasing", authority: "PURCHASE_READ" },
  { to: "/finance", label: "Billing & Finance", authority: "FINANCE_READ" },
  { to: "/workforce", label: "HR & Payroll", authority: "WORKFORCE_READ" },
  { to: "/website", label: "Website", authority: "WEBSITE_READ" },
  { to: "/reports", label: "Reports", authority: null, adminOnly: true },
];

// The handful of destinations that get a spot on the phone bottom bar. Order matters —
// only the first few visible ones are shown, the rest live behind "More".
const BOTTOM_NAV: { to: string; label: string; authority: string | null; icon: typeof LayoutDashboard }[] = [
  { to: "/dashboard", label: "Home", authority: null, icon: LayoutDashboard },
  { to: "/customers", label: "Customers", authority: "CUSTOMER_READ", icon: Users },
  { to: "/leads", label: "Leads", authority: "LEAD_READ", icon: Target },
  { to: "/projects", label: "Projects", authority: "PROJECT_READ", icon: FolderKanban },
];

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  // BASE_URL keeps the redirect inside the CRM (/crm/ in production) instead of the public site.
  window.location.href = import.meta.env.BASE_URL + "login";
}

export default function DashboardLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { authorities, isAdmin, hasAuthority, isFieldEmployee } = useAuth();

  // Older sessions may predate the userRoles localStorage entry — fall back to showing
  // everything rather than an empty sidebar (backend still enforces access).
  const legacySession = authorities.length === 0;
  const canSee = (item: { authority: string | null; adminOnly?: boolean }) =>
    legacySession || (item.adminOnly ? isAdmin : item.authority === null || hasAuthority(item.authority));

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [location.pathname]); // Also refresh when navigating

  // Close the mobile drawer whenever the route changes so navigation feels immediate.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const fetchUnreadCount = () => {
    api.get("/notifications/unread-count")
      .then(res => setUnreadCount(res.data))
      .catch(() => {});
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-md flex items-center justify-between group transition-colors ${
      isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent"
    }`;

  // Shared navigation body — rendered inside both the desktop sidebar and the mobile drawer.
  const NavBody = () => (
    <nav className="flex flex-col gap-1 p-4 flex-1">
      {NAV_ITEMS.filter(canSee).map((item) => (
        <NavLink key={item.to} to={item.to} className={navLinkClass}>
          <span>{item.label}</span>
          {item.underMaintenance && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30 dark:bg-amber-950 dark:text-amber-300">
              Maint.
            </span>
          )}
        </NavLink>
      ))}
      <NavLink to="/notifications" className={navLinkClass}>
        <span>Notifications</span>
        {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>}
      </NavLink>
      {(legacySession || isAdmin) && (
        <>
          <NavLink to="/users" className={navLinkClass}>Users</NavLink>
          <NavLink to="/settings" className={navLinkClass}>Settings</NavLink>
        </>
      )}
      <div className="mt-auto pt-4 border-t">
        <button
          onClick={logout}
          className="w-full px-4 py-2 rounded-md flex items-center gap-2 text-left hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </nav>
  );

  const bottomItems = BOTTOM_NAV.filter(canSee);

  // Field employees reach the desktop workflow pages (Site Visit / Measurement / BOQ / Quotation,
  // and a lead's page) only through their assigned tasks — they must never see the admin ERP chrome
  // (sidebar of admin modules, bottom nav). Render a stripped, portal-style shell for them: just a
  // back control, the app name, and logout. The page content stays full-width and untouched.
  if (isFieldEmployee) {
    const goBack = () =>
      window.history.length > 1 ? window.history.back() : (window.location.href = import.meta.env.BASE_URL + "employee");
    return (
      <div className="flex flex-col h-screen w-full bg-background">
        <header className="h-14 border-b flex items-center justify-between gap-2 px-3 sm:px-4 bg-card shrink-0">
          <button
            onClick={goBack}
            className="flex items-center gap-1 p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <span className="font-bold truncate">Arudra CRM</span>
          <button
            onClick={logout}
            className="flex items-center gap-1 p-2 -mr-2 rounded-md text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto bg-muted/20">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Desktop sidebar — persistent from lg up */}
      <aside className="hidden lg:flex w-64 border-r bg-card flex-col overflow-y-auto shrink-0">
        <div className="p-6 text-xl font-bold border-b sticky top-0 bg-card z-10">Arudra CRM</div>
        <NavBody />
      </aside>

      {/* Mobile / tablet drawer — off-canvas below lg */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-card border-r flex flex-col overflow-y-auto animate-in slide-in-from-left-8">
            <div className="p-4 flex items-center justify-between border-b sticky top-0 bg-card z-10">
              <span className="text-lg font-bold">Arudra CRM</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="p-2 -mr-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavBody />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-4 sm:px-6 bg-card shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="lg:hidden text-lg font-bold truncate">Arudra CRM</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/notifications" className="relative cursor-pointer hover:text-primary transition-colors" aria-label="Notifications">
              <Bell className="w-6 h-6 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-bold text-white items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </span>
              )}
            </Link>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-gold font-bold text-xs shadow-sm ring-2 ring-gold/40">
              A
            </div>
          </div>
        </header>

        {/* Page Content — extra bottom padding on phones so the bottom nav never overlaps content */}
        <main className="flex-1 overflow-y-auto bg-muted/20 pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Phone bottom navigation — primary destinations one thumb-reach away */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-card border-t flex items-stretch justify-around">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 text-[11px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="w-5 h-5" />
          More
        </button>
      </nav>
    </div>
  );
}
