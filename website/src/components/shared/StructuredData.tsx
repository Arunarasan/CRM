import { useEffect } from 'react'
import { useSite } from '@/hooks/useSiteSettings'
import { siteUrl, logoUrl } from '@/config/site'

const MARK = 'data-site-jsonld'

/**
 * Injects a site-wide LocalBusiness JSON-LD block built from the resolved site config (CRM/env
 * overlaid on defaults), so the real NAP — name, address, phone, email, hours, socials — is the
 * source of truth rather than anything hardcoded. Mounted once in the public layout; it re-emits
 * if the CMS settings load in after first paint. Kept separate from page-scoped JSON-LD.
 */
export function StructuredData() {
  const site = useSite()

  useEffect(() => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${siteUrl}/#business`,
      name: site.name,
      description: `${site.name} — ${site.tagline}. ${site.positioning}`,
      url: `${siteUrl}/`,
      logo: logoUrl,
      image: logoUrl,
      telephone: site.phone,
      email: site.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.address,
        addressCountry: 'IN',
      },
      openingHours: 'Mo-Sa 10:00-19:00',
      priceRange: '₹₹₹',
      sameAs: [
        site.social.instagram,
        site.social.facebook,
        site.social.linkedin,
        site.social.pinterest,
      ].filter(Boolean),
    }

    document.head.querySelectorAll(`script[${MARK}]`).forEach((n) => n.remove())
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.setAttribute(MARK, 'true')
    s.textContent = JSON.stringify(data)
    document.head.appendChild(s)

    return () => {
      document.head.querySelectorAll(`script[${MARK}]`).forEach((n) => n.remove())
    }
  }, [site])

  return null
}
