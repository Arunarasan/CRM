/**
 * Central site configuration. Contact details, brand copy, and integration URLs come
 * from environment variables so nothing (numbers, emails, the WhatsApp line) is
 * hardcoded across components.
 */
/**
 * Canonical production origin. Every canonical tag, og:url, sitemap entry, and structured-data
 * URL is built from this so Google sees ONE consistent host (no www / non-www duplication).
 * Kept without a trailing slash; callers append the path.
 */
export const siteUrl = 'https://jbdecorcdm.com'

/** Absolute URL to the brand logo, used as the default social-share (og:image) image. */
export const logoUrl = `${siteUrl}/jb-decor-logo.png`

/** Turns a relative asset/path into an absolute URL on the canonical host. */
export function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return siteUrl + '/'
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return siteUrl + (pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`)
}

export const site = {
  name: 'JB Decor',
  tagline: 'Premium Interior Design & Décor',
  positioning: 'Crafting Spaces. Defining Luxury.',
  whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER || '919000000000',
  phone: import.meta.env.VITE_CONTACT_PHONE || '+91 90000 00000',
  email: import.meta.env.VITE_CONTACT_EMAIL || 'hello@jbdecor.com',
  address: import.meta.env.VITE_CONTACT_ADDRESS || 'JB Decor Studio, Bengaluru, India',
  crmUrl: import.meta.env.VITE_CRM_URL || '/crm',
  businessHours: 'Mon – Sat · 10:00 AM – 7:00 PM',
  social: {
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    pinterest: 'https://pinterest.com',
    linkedin: 'https://linkedin.com',
  },
} as const

/** Primary navigation shown in the header. */
export const mainNav = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
  { label: 'Services', to: '/services' },
  { label: 'Portfolio', to: '/portfolio' },
  { label: 'Design Studio', to: '/design-studio' },
  { label: 'Materials', to: '/materials' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact', to: '/contact' },
] as const

/** Builds a wa.me link with an optional prefilled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${site.whatsappNumber}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
