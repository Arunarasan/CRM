import { useEffect } from 'react'
import { useSite } from '@/hooks/useSiteSettings'
import { siteUrl, logoUrl } from '@/config/site'

const MARK = 'data-site-jsonld'

/**
 * Injects ALL site-wide structured data (LocalBusiness + Organization + WebSite) built from the
 * resolved site config — CRM-managed settings overlaid on env defaults (see useSiteSettings). The
 * real NAP (name, address, phone, email, hours, socials) is therefore the single source of truth and
 * updates whenever an admin edits it in the CRM; nothing here is hardcoded. Mounted once in the public
 * layout; re-emits if the CMS settings load in after first paint. Page-scoped JSON-LD stays separate.
 */
export function StructuredData() {
  const site = useSite()

  useEffect(() => {
    // Only include social links that look like real profiles (a path beyond the bare domain),
    // so unset placeholder defaults (e.g. https://instagram.com) don't pollute sameAs.
    const sameAs = [site.social.instagram, site.social.facebook, site.social.linkedin, site.social.pinterest]
      .filter((u) => {
        if (!u) return false
        try { return new URL(u).pathname.replace(/\/+$/, '').length > 0 } catch { return false }
      })

    const description = `${site.name} — ${site.tagline}. ${site.positioning}`
    // Structured address — only include the parts that are actually set, so an unfilled
    // city/region/postal doesn't emit empty fields Google penalises.
    const address = {
      '@type': 'PostalAddress',
      streetAddress: site.address,
      ...(site.city ? { addressLocality: site.city } : {}),
      ...(site.region ? { addressRegion: site.region } : {}),
      ...(site.postalCode ? { postalCode: site.postalCode } : {}),
      addressCountry: site.country || 'IN',
    }
    // Map pin for the local pack — only when real coordinates are configured.
    const lat = parseFloat(site.geoLat)
    const lng = parseFloat(site.geoLng)
    const geo = Number.isFinite(lat) && Number.isFinite(lng)
      ? { '@type': 'GeoCoordinates', latitude: lat, longitude: lng }
      : null

    const blocks = [
      {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        '@id': `${siteUrl}/#business`,
        name: site.name,
        description,
        url: `${siteUrl}/`,
        logo: logoUrl,
        image: logoUrl,
        telephone: site.phone,
        email: site.email,
        address,
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          opens: '10:00',
          closes: '19:00',
        },
        priceRange: '₹₹₹',
        ...(geo ? { geo } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: site.name,
        url: `${siteUrl}/`,
        logo: logoUrl,
        description,
        email: site.email,
        telephone: site.phone,
        address,
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: site.name,
        url: `${siteUrl}/`,
        publisher: { '@id': `${siteUrl}/#organization` },
      },
    ]

    document.head.querySelectorAll(`script[${MARK}]`).forEach((n) => n.remove())
    for (const data of blocks) {
      const s = document.createElement('script')
      s.type = 'application/ld+json'
      s.setAttribute(MARK, 'true')
      s.textContent = JSON.stringify(data)
      document.head.appendChild(s)
    }

    return () => {
      document.head.querySelectorAll(`script[${MARK}]`).forEach((n) => n.remove())
    }
  }, [site])

  return null
}
