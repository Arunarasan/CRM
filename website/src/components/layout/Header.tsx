import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Search, Heart, ShoppingBag, User, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mainNav } from '@/config/site'
import { useCartCount } from '@/store/cart'
import { useWishlistCount } from '@/store/wishlist'
import { Logo } from './Logo'
import { SearchOverlay } from './SearchOverlay'

/** Small gold count badge for cart/wishlist icons. */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-forest">
      {count > 9 ? '9+' : count}
    </span>
  )
}

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const cartCount = useCartCount()
  const wishCount = useWishlistCount()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full bg-forest transition-all duration-300',
        scrolled && 'shadow-header',
      )}
    >
      <div className="container flex items-center justify-between gap-6">
        <div className={cn('flex items-center transition-all duration-300', scrolled ? 'py-3' : 'py-4')}>
          <Logo />
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 xl:flex" aria-label="Primary">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'link-underline text-[13px] font-medium uppercase tracking-wide transition-colors',
                  isActive ? 'text-gold' : 'text-ivory/85 hover:text-gold',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSearchOpen(true)} aria-label="Search" className="hidden h-10 w-10 items-center justify-center text-ivory/85 transition-colors hover:text-gold sm:flex">
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <Link to="/wishlist" aria-label="Wishlist" className="relative hidden h-10 w-10 items-center justify-center text-ivory/85 transition-colors hover:text-gold sm:flex">
            <Heart className="h-5 w-5" strokeWidth={1.5} />
            <CountBadge count={wishCount} />
          </Link>
          <Link to="/cart" aria-label="Cart" className="relative flex h-10 w-10 items-center justify-center text-ivory/85 transition-colors hover:text-gold">
            <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
            <CountBadge count={cartCount} />
          </Link>
          <Link
            to="/login"
            className="ml-1 hidden items-center gap-2 border border-gold/60 px-4 py-2 text-[13px] font-semibold uppercase tracking-wide text-ivory transition-colors hover:bg-gold hover:text-forest sm:flex"
          >
            <User className="h-4 w-4" strokeWidth={1.5} />
            Login
          </Link>
          <button
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center text-ivory xl:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 xl:hidden',
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!menuOpen}
      >
        <div
          onClick={() => setMenuOpen(false)}
          className={cn(
            'absolute inset-0 bg-forest-deep/70 transition-opacity duration-300',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cn(
            'absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col bg-forest px-6 py-5 transition-transform duration-300',
            menuOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex items-center justify-between">
            <Logo />
            <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center text-ivory">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="mt-8 flex flex-col" aria-label="Mobile">
            {mainNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'border-b border-ivory/10 py-4 text-sm font-medium uppercase tracking-wide transition-colors',
                    isActive ? 'text-gold' : 'text-ivory/85',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Link
            to="/login"
            className="mt-8 flex items-center justify-center gap-2 border border-gold px-4 py-3 text-sm font-semibold uppercase tracking-wide text-ivory transition-colors hover:bg-gold hover:text-forest"
          >
            <User className="h-4 w-4" /> Login
          </Link>
        </div>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
