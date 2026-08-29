import { useEffect } from 'react'
import { site, siteUrl, logoUrl, absoluteUrl } from '@/config/site'

const SITE = site.name
const DEFAULT_DESCRIPTION =
  'JB Decor crafts bespoke luxury interiors — residential, commercial, and turnkey design. Explore our portfolio, browse premium décor, and book a consultation.'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** Page-scoped JSON-LD is tagged so it can be cleared on navigation without touching the
 *  site-wide structured data baked into index.html. */
const JSONLD_MARK = 'data-page-jsonld'

function setPageJsonLd(blocks: object[]) {
  document.head.querySelectorAll(`script[${JSONLD_MARK}]`).forEach((n) => n.remove())
  for (const block of blocks) {
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.setAttribute(JSONLD_MARK, 'true')
    s.textContent = JSON.stringify(block)
    document.head.appendChild(s)
  }
}

export interface SeoOptions {
  /** Page-specific title; the site name is appended automatically. */
  title: string
  /** Meta description / social description. Falls back to the site default. */
  description?: string
  /** Social-share image (relative or absolute). Falls back to the brand logo. */
  image?: string
  /** Canonical/og:url path override. Defaults to the current pathname. */
  path?: string
  /** og:type — 'website' for listings, 'article'/'product' where it fits. */
  type?: string
  /** Set for pages that should not be indexed. */
  noIndex?: boolean
  /** Page-scoped structured data (JSON-LD). One object or several. */
  jsonLd?: object | object[]
}

/**
 * Sets per-page SEO on the client: title, description, canonical, Open Graph, Twitter cards,
 * robots, and optional structured data. This is a SPA, so metadata is applied at runtime — the
 * static defaults in index.html cover no-JS crawlers, and this overlays page-accurate values once
 * React renders. Canonical/og:url always use the fixed production host so there is no www drift.
 */
export function useSeo(opts: SeoOptions) {
  const { title, description, image, path, type = 'website', noIndex = false } = opts
  const jsonLd = opts.jsonLd
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE}` : `${SITE} — ${site.tagline}`
    const desc = description || DEFAULT_DESCRIPTION
    const canonical = siteUrl + (path ?? window.location.pathname)
    const img = image ? absoluteUrl(image) : logoUrl

    document.title = fullTitle
    upsertMeta('name', 'description', desc)
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow')

    upsertMeta('property', 'og:site_name', SITE)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', desc)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:image', img)

    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', desc)
    upsertMeta('name', 'twitter:image', img)

    upsertCanonical(canonical)

    const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []
    setPageJsonLd(blocks)

    return () => setPageJsonLd([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, image, path, type, noIndex, jsonLdKey])
}

/** Builds a BreadcrumbList JSON-LD block from ordered {name, path} crumbs (path relative). */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  }
}

/**
 * Builds an ItemList JSON-LD block for a listing page (categories, services, projects…), giving
 * Google an explicit, ordered set of the page's key links to surface.
 */
export function itemListJsonLd(name: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.path),
    })),
  }
}
