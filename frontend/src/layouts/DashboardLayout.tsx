import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Bell, Search, LogOut } from "lucide-react";
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
  { to: "/site-visits", label: "Site Visits", authority: "SITE_VISIT_READ" },
  // Measurements, BOQ and Quotations are no longer standalone modules — they are managed
  // inside the Lead (pre-sale) and Project (post-sale) profiles, so they have no sidebar entry.
  { to: "/projects", label: "Projects", authority: "PROJECT_READ" },
  { to: "/tasks", label: "Tasks", authority: "TASK_READ" },
  { to: "/assignments", label: "Smart Assign", authority: "ASSIGNMENT_READ" },
  { to: "/inventory", label: "Inventory", authority: "INVENTORY_READ", underMaintenance: true },
  { to: "/purchases", label: "Purchasing", authority: "PURCHASE_READ", underMaintenance: true },
  { to: "/finance", label: "Billing & Finance", authority: "FINANCE_READ", underMaintenance: true },
  { to: "/workforce", label: "Workforce", authority: "WORKFORCE_READ" },
  { to: "/hr", label: "Payroll & Leave", authority: null, adminOnly: true },
  { to: "/reports", label: "Reports", authority: null, adminOnly: true },
];

export default function DashboardLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const { authorities, isAdmin, hasAuthority } = useAuth();

  // Older sessions may predate the userRoles localStorage entry — fall back to showing
  // everything rather than an empty sidebar (backend still enforces access).
  const legacySession = authorities.length === 0;
  const canSee = (item: (typeof NAV_ITEMS)[number]) =>
    legacySession || (item.adminOnly ? isAdmin : item.authority === null || hasAuthority(item.authority));

  useEffect(() => {
    // Poll or fetch unread count
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [location.pathname]); // Also refresh when navigating

  const fetchUnreadCount = () => {
      api.get("/notifications/unread-count")
          .then(res => setUnreadCount(res.data))
          .catch(() => {});
  };

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col overflow-y-auto">
        <div className="p-6 text-xl font-bold border-b sticky top-0 bg-card z-10">Arudra CRM</div>
        <nav className="flex flex-col gap-2 p-4">
          {NAV_ITEMS.filter(canSee).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="px-4 py-2 hover:bg-accent rounded-md flex items-center justify-between group"
            >
              <span>{item.label}</span>
              {item.underMaintenance && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30 dark:bg-amber-950 dark:text-amber-300">
                  Maint.
                </span>
              )}
            </Link>
          ))}
          <Link to="/notifications" className="px-4 py-2 hover:bg-accent rounded-md flex justify-between items-center">
            Notifications
            {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </Link>
          {(legacySession || isAdmin) && (
            <>
              <Link to="/users" className="px-4 py-2 hover:bg-accent rounded-md">Users</Link>
              <Link to="/settings" className="px-4 py-2 hover:bg-accent rounded-md">Settings</Link>
            </>
          )}
          <div className="mt-auto pt-4 border-t">
            <Link to="/login" className="px-4 py-2 hover:bg-destructive hover:text-destructive-foreground rounded-md block">Logout</Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0">
          <div className="flex items-center text-muted-foreground bg-accent/50 px-3 py-1.5 rounded-md w-64">
            <Search className="w-4 h-4 mr-2" />
            <input type="text" placeholder="Search..." className="bg-transparent outline-none text-sm w-full" />
          </div>
          <div className="flex items-center gap-6">
            <Link to="/notifications" className="relative cursor-pointer hover:text-primary transition-colors">
                <Bell className="w-6 h-6 text-slate-600" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-bold text-white items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                )}
            </Link>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm border border-blue-700">
                A
            </div>
            <button 
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
              }}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-muted/20">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
