import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ListChecks, Bell, WifiOff, Search, Inbox, LayoutGrid, CloudUpload, Loader2, Gift } from 'lucide-react';
import OutboxSheet from '@/components/OutboxSheet';
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
const WIDE_ROUTES = ['/employee/quote/new', '/employee/boq-quote/new', '/employee/lead/'];

export default function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useT();
  const unreadCount = useUnreadNotificationCount();
  const { isOnline, queueSize, failedCount, syncing } = useOfflineQueue();
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  // Unopened gifts (money given) — badge on the Gifts tab; refreshed on every navigation.
  const [newGifts, setNewGifts] = useState(0);

  useEffect(() => {
    employeePortalApi.me().then((p) => setPhoto(p.profilePhotoUrl ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    const refresh = () => employeePortalApi.celebrations().then((c) => setNewGifts(c.unopened)).catch(() => {});
    refresh();
    window.addEventListener('gifts-changed', refresh); // the Gifts page opened one
    return () => window.removeEventListener('gifts-changed', refresh);
  }, [location.pathname]);

  // Bottom nav: Home · Tasks · Requests · More. Project work now lives inside Tasks (a "Projects"
  // filter), so it's no longer a separate destination. The More tab opens the account hub
  // (/employee/more), from which attendance, salary, documents, settings, etc. hang.
  const navItems = [
    { to: '/employee', labelKey: 'portal.nav.home', icon: Home, match: (p: string) => p === '/employee' },
    { to: '/employee/tasks', labelKey: 'portal.nav.tasks', icon: ListChecks, match: (p: string) => p.startsWith('/employee/tasks') },
    { to: '/employee/gifts', labelKey: 'pw.nav.gifts', icon: Gift, badge: newGifts, match: (p: string) => p.startsWith('/employee/gifts') },
    { to: '/employee/requests', labelKey: 'portal.nav.requests', icon: Inbox, match: (p: string) => ['/employee/requests', '/employee/leave', '/employee/leads', '/employee/daily-reports'].some((r) => p.startsWith(r)) },
    { to: '/employee/more', labelKey: 'portal.nav.more', icon: LayoutGrid, match: (p: string) => ['/employee/more', '/employee/profile', '/employee/attendance', '/employee/salary', '/employee/documents', '/employee/timesheet', '/employee/settings'].some((r) => p.startsWith(r)) },
  ];

  // Work-surface pages (the quote sheet) are used on tablets and laptops too: let them take the full
  // width there. Everything else stays a phone-width column.
  const wide = WIDE_ROUTES.some((r) => location.pathname.startsWith(r));
  const onSearch = location.pathname.startsWith('/employee/search');

  return (
    <div className={`flex h-dvh w-full flex-col bg-[#F7F7F5] mx-auto shadow-sm ${wide ? 'max-w-md md:max-w-none' : 'max-w-md md:max-w-2xl lg:max-w-3xl'}`}>
      {/* Premium forest header */}
      <header className="sticky top-0 z-20 shrink-0 bg-[#012B1D] px-4 pt-3 pb-3">
        <div className="flex h-11 items-center justify-between">
          <Link to="/employee" className="flex items-center" aria-label={t('pw.layout.homeAria')}>
            <Logo size="sm" />
          </Link>

          <div className="flex items-center gap-2">
            {(!isOnline || queueSize > 0) && (
              <button
                onClick={() => setOutboxOpen(true)}
                aria-label="Offline and waiting items"
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold active:scale-95 ${failedCount > 0 ? 'bg-red-100 text-red-700' : 'bg-[#F4E5C2] text-[#9D6B10]'}`}
              >
                {!isOnline ? <WifiOff className="h-3 w-3" /> : syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
                {queueSize > 0 ? queueSize : t('pw.layout.offline')}
              </button>
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
              aria-label={t('pw.layout.myProfileAria')}
            >
              {photo ? (
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[#0A573B] text-xs font-bold text-white">{t('pw.layout.me')}</span>
              )}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#012B1D] bg-[#2F8F65]" />
            </button>
          </div>
        </div>
      </header>

      {/* Wide pages dock their own sticky action bar at the bottom, so no FAB clearance (sticky bars
          stop short of a scroll container's bottom padding) and no floating search covering it. */}
      <main className={`flex-1 overflow-y-auto ${wide ? '' : 'pb-24'}`}>
        <Outlet />
      </main>

      {!wide && !onSearch && <button
        onClick={() => navigate('/employee/search')}
        className="fixed bottom-24 right-4 z-30 md:right-[max(1rem,calc((100vw-42rem)/2+1rem))] lg:right-[max(1rem,calc((100vw-48rem)/2+1rem))] flex h-12 w-12 items-center justify-center rounded-full bg-[#C48A16] text-white shadow-lg shadow-black/20 active:scale-95"
        aria-label={t('pw.layout.quickSearch')}
      >
        <Search className="h-5 w-5" />
      </button>}

      {/* Premium forest bottom nav (kept phone-width and centred on wide pages) */}
      <nav
        className="sticky bottom-0 z-20 shrink-0 bg-[#002B1D] px-2 pt-2.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.625rem)' }}
      >
       <div className="mx-auto grid max-w-md grid-cols-5 gap-1 md:max-w-lg">
        {navItems.map(({ to, labelKey, icon: Icon, match, badge }) => {
          const active = match(location.pathname);
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 py-1 transition-transform active:scale-95"
            >
              <span
                className={`relative flex h-9 w-11 items-center justify-center rounded-xl transition-colors ${
                  active ? 'bg-[#06452F]' : ''
                }`}
              >
                <Icon className={`h-[22px] w-[22px] ${active ? 'text-[#D7AA4A]' : 'text-white/70'}`} />
                {!!badge && badge > 0 && (
                  <span className="absolute right-0.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D7AA4A] px-1 text-[9px] font-bold text-[#012B1D]">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-medium ${active ? 'text-[#D7AA4A]' : 'text-white/60'}`}>
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
       </div>
      </nav>
      <OutboxSheet open={outboxOpen} onClose={() => setOutboxOpen(false)} />
    </div>
  );
}
