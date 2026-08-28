import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { WhatsAppButton } from './WhatsAppButton'
import { Toaster } from '@/components/ui/Toaster'

/** Public site chrome: header, page outlet, footer, floating WhatsApp. */
export function PublicLayout() {
  const { pathname } = useLocation()

  // Scroll to top on route change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
      <Toaster />
    </div>
  )
}
