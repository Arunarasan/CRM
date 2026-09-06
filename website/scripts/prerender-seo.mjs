/**
 * Post-build SEO prerender (no browser required).
 *
 * This site is a client-rendered SPA: per-page <title>, description, canonical and Open Graph tags
 * are set at runtime by useSeo(). That's invisible to crawlers that DON'T run JavaScript — most
 * notably the link-preview bots for WhatsApp, Facebook, LinkedIn, X, and Google's first crawl pass.
 * They read the raw HTML head only, so every shared link would otherwise show the generic homepage
 * card instead of the real page.
 *
 * This script fixes that for the known, static marketing routes: it copies dist/index.html into a
 * per-route dist/<route>/index.html with the correct head baked in. nginx's SPA fallback
 * (try_files $uri $uri/ /index.html) then serves the route-specific file, while the SPA still
 * hydrates and runs exactly as before. Dynamic catalog pages (categories/products) keep their
 * runtime SEO and are covered for discovery by the backend-generated sitemap.
 *
 * Keep the copy here in sync with each page's useSeo() call.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')

const SITE = 'JB Decor'
const SITE_URL = 'https://jbdecorcdm.com'
const LOGO = `${SITE_URL}/jb-decor-logo.png`

// One entry per static route. Titles/descriptions mirror the page's useSeo() call so the
// prerendered head matches what the SPA renders. og:image defaults to the brand logo.
const ROUTES = [
  {
    path: '/products',
    title: 'Our Collections',
    description:
      'Browse JB Decor by category — furniture, lighting, décor, curtains and more. Explore each collection and enquire for made-to-order pieces.',
  },
  {
    path: '/services',
    title: 'Our Services',
    description:
      'Interior design, modular kitchens, wardrobes, lighting, false ceilings, and complete turnkey interiors by JB Decor.',
  },
  {
    path: '/portfolio',
    title: 'Our Portfolio',
    description:
      'A curated look at interiors JB Decor has designed and delivered — residential, commercial, villas, and more.',
  },
  {
    path: '/materials',
    title: 'Materials & Finishes',
    description:
      'Explore the premium materials and finishes JB Decor works with — natural woods, marbles, veneers, laminates, fabrics, glass and hardware for bespoke interiors.',
  },
  {
    path: '/design-studio',
    title: 'Design Studio',
    description:
      'Visualise your space with the JB Decor Design Studio — pick a room, style, palette, materials and décor, then share your concept with our design team.',
  },
  {
    path: '/about',
    title: 'About Us',
    description:
      'For over 16 years, JB Decor has designed and delivered interiors that balance elegance, function, and craftsmanship.',
  },
  {
    path: '/contact',
    title: 'Contact Us',
    description:
      'Get in touch with JB Decor — tell us about your space and book a consultation with our design team.',
  },
  {
    path: '/consultation',
    title: 'Book a Free Consultation',
    description:
      'Book a complimentary interior design consultation with JB Decor. Tell us about your space and get a dedicated designer, transparent quotes, and expert guidance.',
  },
]

/** Replace the content="" of a <meta name|property="key"> tag; no-op if the tag isn't present. */
function setMeta(html, attr, key, content) {
  const re = new RegExp(
    `(<meta\\s+${attr}=["']${escapeRe(key)}["']\\s+content=["'])[^"']*(["']\\s*/?>)`,
    'i',
  )
  return html.replace(re, `$1${escapeAttr(content)}$2`)
}

function setTitle(html, title) {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
}

function setCanonical(html, href) {
  return html.replace(
    /(<link\s+rel=["']canonical["']\s+href=["'])[^"']*(["']\s*\/?>)/i,
    `$1${escapeAttr(href)}$2`,
  )
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function run() {
  const indexPath = join(DIST, 'index.html')
  if (!existsSync(indexPath)) {
    console.error(`[prerender-seo] ${indexPath} not found — run "vite build" first.`)
    process.exit(1)
  }
  const base = await readFile(indexPath, 'utf8')

  for (const r of ROUTES) {
    const fullTitle = `${r.title} — ${SITE}`
    const canonical = SITE_URL + r.path
    let html = base
    html = setTitle(html, fullTitle)
    html = setMeta(html, 'name', 'description', r.description)
    html = setCanonical(html, canonical)
    html = setMeta(html, 'property', 'og:title', fullTitle)
    html = setMeta(html, 'property', 'og:description', r.description)
    html = setMeta(html, 'property', 'og:url', canonical)
    html = setMeta(html, 'property', 'og:image', r.image || LOGO)
    html = setMeta(html, 'name', 'twitter:title', fullTitle)
    html = setMeta(html, 'name', 'twitter:description', r.description)
    html = setMeta(html, 'name', 'twitter:image', r.image || LOGO)

    const outDir = join(DIST, r.path)
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'index.html'), html, 'utf8')
    console.log(`[prerender-seo] wrote dist${r.path}/index.html`)
  }
  console.log(`[prerender-seo] done — ${ROUTES.length} routes prerendered.`)
}

run().catch((e) => {
  console.error('[prerender-seo] failed:', e)
  process.exit(1)
})
