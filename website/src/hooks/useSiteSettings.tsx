import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { site as defaults } from '@/config/site'
import { publicApi, type ContentBlock } from '@/api/publicApi'

/**
 * Resolves CMS-managed site settings over the compiled-in defaults, mirroring `usePublicData`:
 * the app renders defaults immediately (no flash), then overlays whatever the CRM has set on the
 * next fetch. On any failure the defaults stand, so the site works fully standalone.
 *
 * Keys map: brand.name/tagline/positioning, contact.phone/email/whatsapp/address/businessHours,
 * social.instagram/facebook/pinterest/linkedin.
 */
export interface SiteConfig {
  name: string
  tagline: string
  positioning: string
  whatsappNumber: string
  phone: string
  email: string
  address: string
  crmUrl: string
  businessHours: string
  social: { instagram: string; facebook: string; pinterest: string; linkedin: string }
}

const base: SiteConfig = defaults as SiteConfig
const SiteContext = createContext<SiteConfig>(base)

function merge(s: Record<string, string>): SiteConfig {
  if (!s || Object.keys(s).length === 0) return base
  const g = (k: string, fb: string) => (s[k] != null && s[k] !== '' ? s[k] : fb)
  return {
    ...base,
    name: g('brand.name', base.name),
    tagline: g('brand.tagline', base.tagline),
    positioning: g('brand.positioning', base.positioning),
    phone: g('contact.phone', base.phone),
    email: g('contact.email', base.email),
    whatsappNumber: g('contact.whatsapp', base.whatsappNumber),
    address: g('contact.address', base.address),
    businessHours: g('contact.businessHours', base.businessHours),
    social: {
      instagram: g('social.instagram', base.social.instagram),
      facebook: g('social.facebook', base.social.facebook),
      pinterest: g('social.pinterest', base.social.pinterest),
      linkedin: g('social.linkedin', base.social.linkedin),
    },
  }
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SiteConfig>(base)
  useEffect(() => {
    publicApi.settings().then((s) => { if (s) setValue(merge(s)) }).catch(() => { /* keep defaults */ })
  }, [])
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

/** The resolved site config (CRM settings overlaid on defaults). */
export function useSite(): SiteConfig {
  return useContext(SiteContext)
}

/** Builds a wa.me link using the resolved WhatsApp number. */
export function useWhatsappLink(message?: string): string {
  const site = useSite()
  const link = `https://wa.me/${site.whatsappNumber}`
  return message ? `${link}?text=${encodeURIComponent(message)}` : link
}

/**
 * Loads a page's CMS content blocks keyed by section. Returns a `section(key, fallback)` reader so
 * callers overlay CRM-managed copy over their compiled-in defaults — the site stays fully functional
 * if the API is unavailable or a block is absent.
 */
export function usePageContent(page: string) {
  const [blocks, setBlocks] = useState<Record<string, ContentBlock>>({})
  useEffect(() => {
    let active = true
    publicApi.content(page)
      .then((list) => {
        if (!active || !Array.isArray(list)) return
        const m: Record<string, ContentBlock> = {}
        list.forEach((b) => { m[b.sectionKey] = b })
        setBlocks(m)
      })
      .catch(() => { /* keep fallbacks */ })
    return () => { active = false }
  }, [page])

  return {
    blocks,
    section: (key: string) => blocks[key],
    text: (key: string, field: 'title' | 'subtitle' | 'body', fallback: string) =>
      blocks[key]?.[field]?.trim() ? (blocks[key][field] as string) : fallback,
  }
}
