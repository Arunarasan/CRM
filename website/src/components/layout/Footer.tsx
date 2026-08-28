import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import { useSite } from '@/hooks/useSiteSettings'
import { Logo } from './Logo'

/** Inline brand glyphs — this lucide build ships no social icons. */
function BrandIcon({ name, className }: { name: 'instagram' | 'facebook' | 'linkedin'; className?: string }) {
  const paths: Record<string, string> = {
    instagram:
      'M12 2.2c3.2 0 3.6 0 4.9.07 1.17.05 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.37 1.06.42 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.17-1.06.37-2.23.42-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.42a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.17-.42-.37-1.06-.42-2.23C2.2 15.58 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.37 2.23-.42C8.42 2.2 8.8 2.2 12 2.2Zm0 3.2A6.4 6.4 0 1 0 12 18.2 6.4 6.4 0 0 0 12 5.4Zm0 10.56A4.16 4.16 0 1 1 12 7.64a4.16 4.16 0 0 1 0 8.32Zm6.65-10.8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
    facebook:
      'M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z',
    linkedin:
      'M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0ZM3.3 8.48h3.28V21H3.3V8.48ZM9.4 8.48h3.14v1.71h.05c.44-.83 1.5-1.71 3.1-1.71 3.32 0 3.93 2.18 3.93 5.02V21h-3.28v-5.55c0-1.32-.02-3.02-1.84-3.02-1.84 0-2.12 1.44-2.12 2.92V21H9.4V8.48Z',
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

const columns = [
  {
    title: 'Quick Links',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Products', to: '/products' },
      { label: 'Services', to: '/services' },
      { label: 'Portfolio', to: '/portfolio' },
      { label: 'Materials', to: '/materials' },
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Collections',
    links: [
      { label: 'Furniture', to: '/products/furniture' },
      { label: 'Lighting', to: '/products/lighting' },
      { label: 'Décor', to: '/products/decor' },
      { label: 'Curtains', to: '/products/curtains' },
      { label: 'Wardrobes', to: '/products/wardrobes' },
      { label: 'All Collections', to: '/products' },
    ],
  },
  {
    title: 'Customer',
    links: [
      { label: 'My Account', to: '/portal' },
      { label: 'My Projects', to: '/portal/projects' },
      { label: 'Consultation', to: '/consultation' },
      { label: 'Service Requests', to: '/portal/service-requests' },
    ],
  },
]

export function Footer() {
  const site = useSite()
  return (
    <footer className="bg-forest-deep text-ivory/75">
      <div className="container grid grid-cols-2 gap-x-6 gap-y-10 py-12 sm:gap-y-12 md:grid-cols-2 md:py-16 lg:grid-cols-5">
        {/* Brand */}
        <div className="col-span-2 lg:col-span-2">
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ivory/60">
            {site.name} crafts bespoke luxury interiors — residential, commercial, and turnkey.
            Design, décor, and flawless execution under one signature.
          </p>
          <div className="mt-6 flex gap-3">
            {([
              { name: 'instagram', href: site.social.instagram, label: 'Instagram' },
              { name: 'facebook', href: site.social.facebook, label: 'Facebook' },
              { name: 'linkedin', href: site.social.linkedin, label: 'LinkedIn' },
            ] as const).map(({ name, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center border border-ivory/15 text-ivory/70 transition-colors hover:border-gold hover:text-gold"
              >
                <BrandIcon name={name} className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold">
              {col.title}
            </h3>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm text-ivory/65 transition-colors hover:text-gold">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Contact strip */}
      <div className="border-t border-ivory/10">
        <div className="container grid gap-4 py-6 text-sm text-ivory/70 sm:grid-cols-2 lg:grid-cols-4">
          <a href={`tel:${site.phone}`} className="flex items-center gap-3 transition-colors hover:text-gold">
            <Phone className="h-4 w-4 text-gold" /> {site.phone}
          </a>
          <a href={`mailto:${site.email}`} className="flex items-center gap-3 transition-colors hover:text-gold">
            <Mail className="h-4 w-4 text-gold" /> {site.email}
          </a>
          <span className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-gold" /> {site.address}
          </span>
          <span className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-gold" /> {site.businessHours}
          </span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-ivory/10">
        <div className="container flex flex-col items-center justify-between gap-3 py-5 text-xs text-ivory/50 md:flex-row">
          <p>© {new Date().getFullYear()} {site.name} &amp; Arudra Commercial Services. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/privacy" className="transition-colors hover:text-gold">Privacy Policy</Link>
            <Link to="/terms" className="transition-colors hover:text-gold">Terms</Link>
            <Link to="/refund" className="transition-colors hover:text-gold">Refund Policy</Link>
          </div>
        </div>
        <div className="container border-t border-ivory/5 py-4 text-center text-[11px] text-ivory/40">
          Designed &amp; developed by <span className="font-medium text-ivory/60">Arun</span>
        </div>
      </div>
    </footer>
  )
}
