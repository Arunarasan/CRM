import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ListChecks, Bell, WifiOff, Search, FolderKanban, Inbox, UserCircle } from 'lucide-react';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

/**
 * Mobile-first shell for the Employee Task module — bottom nav + FAB + sticky header.
 * Deliberately NOT DashboardLayout: field employees never see the desktop sidebar/table UI.
 */
export default function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const unreadCount = useUnreadNotificationCount();
  const { isOnline, queueSize } = useOfflineQueue();

  // Spec bottom nav: Home · Tasks · Projects · Requests · Profile. The Profile tab opens the
  // account hub (/employee/more), from which attendance, salary, documents, settings, etc. hang.
  const navItems = [
    { to: '/employee', label: 'Home', icon: Home, match: (p: string) => p === '/employee' },
    { to: '/employee/tasks', label: 'Tasks', icon: ListChecks, match: (p: string) => p.startsWith('/employee/tasks') },
    { to: '/employee/projects', label: 'Projects', icon: FolderKanban, match: (p: string) => p.startsWith('/employee/projects') },
    { to: '/employee/requests', label: 'Requests', icon: Inbox, match: (p: string) => ['/employee/requests', '/employee/leave', '/employee/leads', '/employee/daily-reports'].some((r) => p.startsWith(r)) },
    { to: '/employee/more', label: 'Profile', icon: UserCircle, match: (p: string) => ['/employee/more', '/employee/profile', '/employee/attendance', '/employee/salary', '/employee/documents', '/employee/timesheet', '/employee/settings'].some((r) => p.startsWith(r)) },
  ];

  return (
    <div className="flex h-screen w-full flex-col bg-muted/20 max-w-md mx-auto border-x shadow-sm">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
        <span className="text-base font-bold">Arudra Field</span>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              <WifiOff className="h-3 w-3" /> Offline{queueSize > 0 ? ` (${queueSize})` : ''}
            </span>
          )}
          <Link to="/employee/notifications" className="relative">
            <Bell className="h-6 w-6 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <button
        onClick={() => navigate('/employee/tasks?search=1')}
        className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
        aria-label="Quick search"
      >
        <Search className="h-5 w-5" />
      </button>

      <nav className="sticky bottom-0 z-20 grid shrink-0 grid-cols-5 border-t bg-card">
        {navItems.map(({ to, label, icon: Icon, match }) => {
          const active = match(location.pathname);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
