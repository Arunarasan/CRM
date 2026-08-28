import { useEffect } from 'react'

const SITE = 'JB Decor'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Sets per-page SEO on the client (title, description, canonical, Open Graph). This is a SPA, so
 * meta is applied at runtime; for crawler-critical pages, pair with SSR/prerendering in future.
 */
export function useSeo({ title, description }: { title: string; description?: string }) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE}`
    document.title = fullTitle
    setMeta('property', 'og:title', fullTitle)
    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
    }
    setCanonical(window.location.origin + window.location.pathname)
  }, [title, description])
}
