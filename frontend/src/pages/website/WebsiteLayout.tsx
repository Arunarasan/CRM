import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Images, LayoutGrid, ShoppingBag, Wrench, FolderKanban, Layers, Quote, ExternalLink, ClipboardList, Inbox,
  FileText, Settings, Star,
} from 'lucide-react';

type Tab = { to: string; label: string; icon: typeof Images; end?: boolean };

// Grouped by what the admin is actually doing, so 12 sections scan like a real CMS rather than a
// flat wall of buttons: the marketing catalog, the things customers send in, and site-wide config.
const GROUPS: { label: string; tabs: Tab[] }[] = [
  {
    label: 'Catalog',
    tabs: [
      { to: '/website', label: 'Hero Slides', icon: Images, end: true },
      { to: '/website/categories', label: 'Categories', icon: LayoutGrid },
      { to: '/website/products', label: 'Products', icon: ShoppingBag },
      { to: '/website/services', label: 'Services', icon: Wrench },
      { to: '/website/portfolio', label: 'Portfolio', icon: FolderKanban },
      { to: '/website/materials', label: 'Materials', icon: Layers },
      { to: '/website/testimonials', label: 'Testimonials', icon: Quote },
    ],
  },
  {
    label: 'Inbox',
    tabs: [
      { to: '/website/orders', label: 'Orders', icon: ClipboardList },
      { to: '/website/service-requests', label: 'Requests', icon: Inbox },
      { to: '/website/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    label: 'Configure',
    tabs: [
      { to: '/website/content', label: 'Content', icon: FileText },
      { to: '/website/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ALL_TABS = GROUPS.flatMap((g) => g.tabs);

// The public site root. In production the CRM is served under /crm and the site at /, so the
// site is one level up from the CRM base; in dev it's the standalone website dev server.
const SITE_URL = import.meta.env.VITE_SITE_URL || '/';

export default function WebsiteLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = ALL_TABS.find((t) => (t.end ? pathname === t.to : pathname.startsWith(t.to))) ?? ALL_TABS[0];

  return (
    <div className="min-h-full bg-slate-50 px-4 md:px-6 pb-8">
      <div className="flex items-start justify-between gap-4 pt-4 md:pt-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Website</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Manage the public marketing site — hero, catalog, services, portfolio, materials and
            testimonials. Changes go live immediately.
          </p>
        </div>
        <a
          href={SITE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary transition-colors"
        >
          <ExternalLink className="h-4 w-4" /> <span className="hidden sm:inline">View live site</span>
        </a>
      </div>

      <div className="mt-5 flex gap-6">
        {/* Desktop: grouped secondary sidebar. Sticks while the page scrolls (single scroll). */}
        <aside className="hidden md:block w-52 shrink-0 self-start sticky top-4">
          <nav className="space-y-5">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</p>
                <div className="space-y-0.5">
                  {g.tabs.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" /> {label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile: the same grouped list as a compact dropdown so it takes no vertical space. */}
          <div className="md:hidden mb-4">
            <label className="sr-only" htmlFor="website-section">Section</label>
            <select
              id="website-section"
              value={current.to}
              onChange={(e) => navigate(e.target.value)}
              className="w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.tabs.map((t) => (
                    <option key={t.to} value={t.to}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
