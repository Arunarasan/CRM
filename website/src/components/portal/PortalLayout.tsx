import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, FileText, ReceiptText, CreditCard, FileArchive,
  Wrench, ShoppingBag, Heart, Bell, User, LogOut, Menu, X, ExternalLink, Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/layout/Logo'
import { useAuth } from '@/lib/auth'

const nav = [
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/portal/projects', label: 'Projects', icon: FolderKanban },
  { to: '/portal/quotations', label: 'Quotations', icon: FileText },
  { to: '/portal/invoices', label: 'Invoices', icon: ReceiptText },
  { to: '/portal/payments', label: 'Payments', icon: CreditCard },
  { to: '/portal/documents', label: 'Documents', icon: FileArchive },
  { to: '/portal/service-requests', label: 'Service Requests', icon: Wrench },
  { to: '/portal/services', label: 'Services', icon: Star },
  { to: '/portal/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/portal/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/portal/notifications', label: 'Notifications', icon: Bell },
  { to: '/portal/profile', label: 'Profile', icon: User },
]

export function PortalLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Portal">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                isActive ? 'bg-gold/15 font-medium text-gold' : 'text-ivory/70 hover:bg-forest-light/50 hover:text-ivory',
              )
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={1.5} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ivory/10 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ivory/60 transition-colors hover:text-gold">
          <ExternalLink className="h-4 w-4" /> Back to Website
        </Link>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ivory/60 transition-colors hover:text-red-300">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-ivory">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-forest lg:block">{SidebarInner}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-forest-deep/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-forest">{SidebarInner}</aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-forest/10 bg-white px-4 py-3 sm:px-6">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="flex h-9 w-9 items-center justify-center text-forest lg:hidden">
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden text-sm text-forest/60 lg:block">
            Welcome back, <span className="font-semibold text-forest">{user?.name || 'Guest'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/portal/notifications" aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center text-forest/70 hover:text-gold">
              <Bell className="h-5 w-5" />
            </Link>
            <Link to="/portal/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-sm font-semibold text-gold">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>

      {/* Close button floats when drawer open */}
      {open && (
        <button onClick={() => setOpen(false)} aria-label="Close menu" className="fixed right-4 top-3 z-[60] flex h-9 w-9 items-center justify-center text-ivory lg:hidden">
          <X className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}
