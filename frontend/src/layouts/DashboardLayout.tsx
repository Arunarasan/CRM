import { useState, useEffect } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import {
  Bell, LogOut, Menu, X, LayoutDashboard, Users, Target, FolderKanban, ChevronLeft,
  ListChecks, Package, ShoppingCart, ReceiptText, Wallet, Contact, Globe,
  Settings as SettingsIcon, ShieldCheck, Search, MessageSquare, ChevronDown, Sparkles,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import Logo from "@/components/brand/Logo";
import { getCurrentUser } from "@/lib/currentUser";
import { useT } from "@/i18n";

/**
 * Sidebar entries gated by the authority needed to actually use the module (matching the
 * backend's @PreAuthorize checks). `authority: null` means visible to every logged-in user.
 * UI-level defense-in-depth only — the backend remains the enforcement point.
 */
const NAV_ITEMS: { to: string; labelKey: string; authority: string | null; adminOnly?: boolean; underMaintenance?: boolean; icon: typeof LayoutDashboard }[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", authority: null, icon: LayoutDashboard },
  { to: "/customers", labelKey: "nav.customers", authority: "CUSTOMER_READ", icon: Users },
  { to: "/leads", labelKey: "nav.leads", authority: "LEAD_READ", icon: Target },
  // Site Visits, Measurements, BOQ and Quotations are no longer standalone modules — the whole
  // pre-sale pipeline is driven from the Lead's Sales Journey (and post-sale from the Project),
  // so none of them get a sidebar entry. Their routes stay alive for in-lead links / deep links.
  { to: "/projects", labelKey: "nav.projects", authority: "PROJECT_READ", icon: FolderKanban },
  { to: "/tasks", labelKey: "nav.tasks", authority: "TASK_READ", icon: ListChecks },
  { to: "/inventory", labelKey: "nav.inventory", authority: "INVENTORY_READ", icon: Package },
  { to: "/purchases", labelKey: "nav.purchasing", authority: "PURCHASE_READ", icon: ShoppingCart },
  { to: "/billing", labelKey: "nav.billing", authority: "FINANCE_READ", icon: ReceiptText },
  { to: "/finance", labelKey: "nav.finance", authority: "FINANCE_READ", icon: Wallet },
  { to: "/workforce", labelKey: "nav.workforce", authority: "WORKFORCE_READ", icon: Contact },
  { to: "/website", labelKey: "nav.website", authority: "WEBSITE_READ", icon: Globe },
];

// The handful of destinations that get a spot on the phone bottom bar. Order matters —
// only the first few visible ones are shown, the rest live behind "More".
const BOTTOM_NAV: { to: string; labelKey: string; authority: string | null; icon: typeof LayoutDashboard }[] = [
  { to: "/dashboard", labelKey: "nav.home", authority: null, icon: LayoutDashboard },
  { to: "/customers", labelKey: "nav.customers", authority: "CUSTOMER_READ", icon: Users },
  { to: "/leads", labelKey: "nav.leads", authority: "LEAD_READ", icon: Target },
  { to: "/projects", labelKey: "nav.projects", authority: "PROJECT_READ", icon: FolderKanban },
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
  const currentUser = getCurrentUser();
  const { t } = useT();

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

  // Nav items live inside the deep-forest sidebar, so they carry their own dark palette:
  // ivory label, gold icon, and a gold left-bar + tinted wash on the active route.
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3.5 py-2.5 rounded-lg flex items-center justify-between gap-2 group transition-colors border-l-[3px] ${
      isActive
        ? "bg-gold/[0.18] text-white font-semibold border-[#D9B06B]"
        : "text-[#E9EFEB] border-transparent hover:bg-white/[0.06]"
    }`;

  const NavItemInner = ({ Icon, label, isActive }: { Icon: typeof LayoutDashboard; label: string; isActive?: boolean }) => (
    <span className="flex items-center gap-3 min-w-0">
      <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? "text-[#D9B06B]" : "text-[#D9B06B]/80 group-hover:text-[#D9B06B]"}`} />
      <span className="truncate">{label}</span>
    </span>
  );

  // Shared navigation body — rendered inside both the desktop sidebar and the mobile drawer.
  // The nav list is the only scrolling region; the logo header (above) and the logout footer
  // (below) stay pinned so logging out never requires scrolling.
  const NavBody = () => (
    <>
    <nav className="flex flex-col gap-1 p-4 flex-1 min-h-0 overflow-y-auto">
      {NAV_ITEMS.filter(canSee).map((item) => (
        <NavLink key={item.to} to={item.to} className={navLinkClass}>
          {({ isActive }) => (
            <>
              <NavItemInner Icon={item.icon} label={t(item.labelKey)} isActive={isActive} />
              {item.underMaintenance && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gold/20 text-[#F0D19B] border border-gold/30">
                  Maint.
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
      <NavLink to="/notifications" className={navLinkClass}>
        {({ isActive }) => (
          <>
            <NavItemInner Icon={Bell} label={t('nav.notifications')} isActive={isActive} />
            {unreadCount > 0 && <span className="bg-gold text-[#1a1205] text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </>
        )}
      </NavLink>
      {(legacySession || isAdmin) && (
        <>
          <NavLink to="/users" className={navLinkClass}>
            {({ isActive }) => <NavItemInner Icon={ShieldCheck} label={t('nav.users')} isActive={isActive} />}
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            {({ isActive }) => <NavItemInner Icon={SettingsIcon} label={t('nav.settings')} isActive={isActive} />}
          </NavLink>
        </>
      )}
      {/* Decorative brand card + copyright — scroll with the nav list */}
      <div className="mt-auto pt-4 space-y-3">
        <div
          className="relative overflow-hidden rounded-xl p-4 border border-white/10"
          style={{ background: "linear-gradient(135deg, rgba(188,135,72,0.28) 0%, rgba(0,53,34,0.55) 55%, rgba(1,35,22,0.85) 100%)" }}
        >
          <Sparkles className="w-5 h-5 text-[#F0D19B] mb-2" />
          <p className="font-script text-[#F5EBD3] text-lg leading-snug">
            {t('nav.tagline')}
          </p>
        </div>
        <p className="text-[11px] text-[#8FA69B] text-center pb-1">© {new Date().getFullYear()} JB Decor</p>
      </div>
    </nav>

    {/* Logout pinned to the bottom of the sidebar — always reachable without scrolling */}
    <div className="shrink-0 border-t border-white/10 p-4">
      <button
        onClick={logout}
        className="w-full px-3.5 py-2.5 rounded-lg flex items-center gap-3 text-left text-[#E9EFEB] hover:bg-destructive/90 hover:text-white transition-colors"
      >
        <LogOut className="w-[18px] h-[18px] text-[#D9B06B]/80" /> {t('nav.logout')}
      </button>
    </div>
    </>
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
            <span className="text-sm font-medium">{t('common.back')}</span>
          </button>
          <Logo size="sm" />
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
      {/* Desktop sidebar — persistent deep-forest navigation from lg up */}
      <aside
        className="hidden lg:flex w-64 flex-col overflow-hidden shrink-0 border-r border-black/20 text-[#F5F4EE]"
        style={{ background: "linear-gradient(180deg, #012316 0%, #003522 100%)" }}
      >
        <div className="px-5 py-6 flex items-center shrink-0 border-b border-white/10" style={{ background: "#012316" }}>
          <Logo />
        </div>
        <NavBody />
      </aside>

      {/* Mobile / tablet drawer — off-canvas below lg */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[#00140C]/55 animate-in fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col overflow-hidden text-[#F5F4EE] animate-in slide-in-from-left-8"
            style={{ background: "linear-gradient(180deg, #012316 0%, #003522 100%)" }}
          >
            <div className="px-4 py-5 flex items-center justify-between shrink-0 border-b border-white/10" style={{ background: "#012316" }}>
              <Logo size="sm" />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="p-2 -mr-1 rounded-md hover:bg-white/10 text-[#C8D2CD] hover:text-white"
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
        {/* Header — warm ivory bar with global search, alerts and profile */}
        <header className="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 shrink-0 bg-card border-b border-border">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="lg:hidden min-w-0">
              <Logo size="sm" />
            </div>
            {/* Global search — presentational entry point (per-module search lives on each page) */}
            <label className="hidden md:flex items-center gap-2 w-full max-w-md h-10 px-3.5 rounded-xl bg-muted/60 border border-border focus-within:border-ring focus-within:bg-card transition-colors">
              <Search className="w-4 h-4 text-gold shrink-0" />
              <input
                type="text"
                placeholder={t('nav.searchPlaceholder')}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </label>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <Link to="/notifications" className="relative p-2 rounded-lg text-muted-foreground hover:text-gold hover:bg-accent transition-colors" aria-label="Notifications">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link to="/notifications" className="hidden sm:inline-flex p-2 rounded-lg text-muted-foreground hover:text-gold hover:bg-accent transition-colors" aria-label="Messages">
              <MessageSquare className="w-5 h-5" />
            </Link>
            {(legacySession || isAdmin) && (
              <Link to="/settings" className="hidden sm:inline-flex p-2 rounded-lg text-muted-foreground hover:text-gold hover:bg-accent transition-colors" aria-label="Settings">
                <SettingsIcon className="w-5 h-5" />
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-full hover:bg-accent transition-colors focus:outline-none">
                <span className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-gold font-bold text-sm ring-2 ring-gold/40">
                  {currentUser.initial}
                </span>
                <span className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-sm font-semibold text-foreground">{currentUser.name}</span>
                  <span className="text-[11px] text-muted-foreground">{currentUser.role}</span>
                </span>
                <ChevronDown className="hidden sm:block w-4 h-4 text-gold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="font-semibold">{currentUser.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{currentUser.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(legacySession || isAdmin) && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/settings"><SettingsIcon className="w-4 h-4 mr-2" /> {t('nav.settings')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/users"><Users className="w-4 h-4 mr-2" /> {t('nav.users')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content — extra bottom padding on phones so the bottom nav never overlaps content */}
        <main className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">
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
            {t(item.labelKey)}
          </NavLink>
        ))}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="w-5 h-5" />
          {t('nav.more')}
        </button>
      </nav>
    </div>
  );
}
