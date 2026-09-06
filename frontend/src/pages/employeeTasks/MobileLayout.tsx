import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ListChecks, Bell, WifiOff, Search, FolderKanban, Inbox, LayoutGrid } from 'lucide-react';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { employeePortalApi } from '@/api/employeePortalApi';
import Logo from '@/components/brand/Logo';
import { useT } from '@/i18n';

/**
 * Mobile-first shell for the Employee Task module — premium forest-green header,
 * gold-accented bottom nav, safe-area aware.
 * Deliberately NOT DashboardLayout: field employees never see the desktop sidebar/table UI.
 */
export default function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useT();
  const unreadCount = useUnreadNotificationCount();
  const { isOnline, queueSize } = useOfflineQueue();
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    employeePortalApi.me().then((p) => setPhoto(p.profilePhotoUrl ?? null)).catch(() => {});
  }, []);

  // Bottom nav: Home · Tasks · Projects · Requests · More. The More tab opens the account hub
  // (/employee/more), from which attendance, salary, documents, settings, etc. hang.
  const navItems = [
    { to: '/employee', labelKey: 'portal.nav.home', icon: Home, match: (p: string) => p === '/employee' },
    { to: '/employee/tasks', labelKey: 'portal.nav.tasks', icon: ListChecks, match: (p: string) => p.startsWith('/employee/tasks') },
    { to: '/employee/projects', labelKey: 'portal.nav.projects', icon: FolderKanban, match: (p: string) => p.startsWith('/employee/projects') },
    { to: '/employee/requests', labelKey: 'portal.nav.requests', icon: Inbox, match: (p: string) => ['/employee/requests', '/employee/leave', '/employee/leads', '/employee/daily-reports'].some((r) => p.startsWith(r)) },
    { to: '/employee/more', labelKey: 'portal.nav.more', icon: LayoutGrid, match: (p: string) => ['/employee/more', '/employee/profile', '/employee/attendance', '/employee/salary', '/employee/documents', '/employee/timesheet', '/employee/settings'].some((r) => p.startsWith(r)) },
  ];

  return (
    <div className="flex h-screen w-full flex-col bg-[#F7F7F5] max-w-md mx-auto shadow-sm">
      {/* Premium forest header */}
      <header className="sticky top-0 z-20 shrink-0 bg-[#012B1D] px-4 pt-3 pb-3">
        <div className="flex h-11 items-center justify-between">
          <Link to="/employee" className="flex items-center" aria-label="JB Decor CRM home">
            <Logo size="sm" />
          </Link>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="flex items-center gap-1 rounded-full bg-[#F4E5C2] px-2 py-0.5 text-[10px] font-semibold text-[#9D6B10]">
                <WifiOff className="h-3 w-3" /> {queueSize > 0 ? queueSize : 'Off'}
              </span>
            )}
            <Link to="/employee/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-white active:bg-white/10">
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D7AA4A] px-1 text-[9px] font-bold text-[#012B1D]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => navigate('/employee/profile')}
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/25 active:scale-95"
              aria-label="My profile"
            >
              {photo ? (
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[#0A573B] text-xs font-bold text-white">Me</span>
              )}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#012B1D] bg-[#2F8F65]" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      <button
        onClick={() => navigate('/employee/tasks?search=1')}
        className="fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#C48A16] text-white shadow-lg shadow-black/20 active:scale-95"
        aria-label="Quick search"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Premium forest bottom nav */}
      <nav
        className="sticky bottom-0 z-20 grid shrink-0 grid-cols-5 gap-1 bg-[#002B1D] px-2 pt-2.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.625rem)' }}
      >
        {navItems.map(({ to, labelKey, icon: Icon, match }) => {
          const active = match(location.pathname);
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 py-1 transition-transform active:scale-95"
            >
              <span
                className={`flex h-9 w-11 items-center justify-center rounded-xl transition-colors ${
                  active ? 'bg-[#06452F]' : ''
                }`}
              >
                <Icon className={`h-[22px] w-[22px] ${active ? 'text-[#D7AA4A]' : 'text-white/70'}`} />
              </span>
              <span className={`text-[10px] font-medium ${active ? 'text-[#D7AA4A]' : 'text-white/60'}`}>
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
