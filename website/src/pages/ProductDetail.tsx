import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MessageCircle, Truck, ShieldCheck, Ruler, Check } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section, SectionHeading } from '@/components/ui/Section'
import { SmartImage } from '@/components/ui/SmartImage'
import { Rating } from '@/components/ui/Rating'
import { Button } from '@/components/ui/Button'
import { ProductCard } from '@/components/cards/ProductCard'
import Placeholder from '@/pages/Placeholder'
import { getProduct, products as productsSeed } from '@/data/products'
import { getProductDetail } from '@/data/productDetails'
import { categories as categoriesSeed } from '@/data/categories'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi, type ApiProductDetail } from '@/api/publicApi'
import { cn } from '@/lib/utils'
import { whatsappLink } from '@/config/site'
import { useSeo, breadcrumbJsonLd } from '@/hooks/useSeo'
import type { ColorVariant } from '@/types'

interface ProductView {
  name: string
  sku: string
  rating: number
  reviewCount: number
  categorySlug: string
  description: string
  gallery: string[]
  specifications: { label: string; value: string }[]
  colors: ColorVariant[]
}

const titleCase = (slug: string) =>
  slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export default function ProductDetail() {
  const { slug = '' } = useParams()
  const [apiProduct, setApiProduct] = useState<ApiProductDetail | null | undefined>(undefined)
  const [activeImg, setActiveImg] = useState(0)
  const [activeColor, setActiveColor] = useState(0)

  // Live catalog (falls back to seed) — used for related products + the category name.
  const products = usePublicData(productsSeed, publicApi.products)
  const categories = usePublicData(categoriesSeed, publicApi.categories)

  // Fetch the rich detail from the API; fall back to seed when it isn't there.
  useEffect(() => {
    let active = true
    setApiProduct(undefined)
    setActiveImg(0)
    setActiveColor(0)
    publicApi.product(slug)
      .then((p) => { if (active) setApiProduct(p ?? null) })
      .catch(() => { if (active) setApiProduct(null) })
    return () => { active = false }
  }, [slug])

  const seed = getProduct(slug)

  const view: ProductView | null = useMemo(() => {
    if (apiProduct) {
      // Live data wins; for any field the API leaves empty, fall back to the seed's rich detail
      // (so demo pages stay complete until the same content is filled in from the CRM).
      const dt = seed ? getProductDetail(seed) : null
      const apiGallery = (apiProduct.gallery ?? []).filter(Boolean) as string[]
      const gallery = apiGallery.length ? apiGallery : (dt?.gallery?.length ? dt.gallery : [apiProduct.image])
      return {
        name: apiProduct.name,
        sku: apiProduct.sku,
        rating: apiProduct.rating ?? 0,
        reviewCount: apiProduct.reviewCount ?? 0,
        categorySlug: apiProduct.categorySlug,
        description: apiProduct.description || dt?.description || apiProduct.shortDescription || '',
        gallery: gallery.filter(Boolean),
        specifications: apiProduct.specifications?.length ? apiProduct.specifications : (dt?.specifications ?? []),
        colors: apiProduct.colors?.length ? apiProduct.colors : (dt?.colors ?? []),
      }
    }
    if (seed) {
      const dt = getProductDetail(seed)
      return {
        name: seed.name,
        sku: seed.sku,
        rating: seed.rating,
        reviewCount: seed.reviewCount,
        categorySlug: seed.categorySlug,
        description: dt.description,
        gallery: dt.gallery,
        specifications: dt.specifications,
        colors: dt.colors,
      }
    }
    return null
  }, [apiProduct, seed])

  useSeo(
    view
      ? {
          title: view.name,
          description:
            view.description ||
            `${view.name} — made-to-order ${titleCase(view.categorySlug)} by JB Decor. Enquire for finishes, availability, and pricing.`,
          image: view.gallery[0],
          type: 'product',
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: view.name,
              description: view.description || undefined,
              image: view.gallery,
              sku: view.sku || undefined,
              category: titleCase(view.categorySlug),
              brand: { '@type': 'Brand', name: 'JB Decor' },
            },
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Products', path: '/products' },
              { name: view.name, path: `/products/${view.categorySlug}/${slug}` },
            ]),
          ],
        }
      : { title: 'Product', noIndex: apiProduct === null && !seed },
  )

  // Still fetching and no seed to show yet.
  if (!view) {
    if (apiProduct === undefined) {
      return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-forest/20 border-t-gold" /></div>
    }
    return <Placeholder title="Product Not Found" note="This piece may have moved — explore the rest of the collection." />
  }

  const categoryName = categories.find((c) => c.slug === view.categorySlug)?.name ?? titleCase(view.categorySlug || 'Products')
  const related = products.filter((p) => p.categorySlug === view.categorySlug && p.slug !== slug).slice(0, 4)

  // The gallery reflects the chosen colour when that variant ships its own image.
  const colorImage = view.colors[activeColor]?.image
  const gallery = colorImage
    ? [colorImage, ...view.gallery.filter((g) => g !== colorImage)]
    : view.gallery
  const heroSrc = gallery[Math.min(activeImg, gallery.length - 1)]

  const enquiryMessage =
    `Hi JB Decor, I'm interested in the ${view.name}` +
    (view.colors.length ? ` (${view.colors[activeColor]?.name} finish)` : '') +
    `. Could you share more details and a quote?`

  return (
    <>
      <PageHeader
        eyebrow={categoryName}
        title={view.name}
        crumbs={[
          { label: 'Products', to: '/products' },
          ...(view.categorySlug ? [{ label: categoryName, to: `/products/${view.categorySlug}` }] : []),
          { label: view.name },
        ]}
      />

      <Section tone="ivory">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          {/* Gallery */}
          <div>
            <div className="group relative aspect-square overflow-hidden border border-forest/10 bg-white">
              <SmartImage
                src={heroSrc}
                alt={`${view.name} view ${activeImg + 1}`}
                className="h-full w-full"
                imgClassName="transition-transform duration-500 group-hover:scale-125"
              />
            </div>
            {gallery.length > 1 && (
              <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto">
                {gallery.map((src, i) => (
                  <button
                    key={src + i}
                    onClick={() => setActiveImg(i)}
                    aria-label={`View image ${i + 1}`}
                    className={cn(
                      'h-20 w-20 shrink-0 overflow-hidden border transition-colors',
                      activeImg === i ? 'border-gold' : 'border-forest/15 hover:border-forest/40',
                    )}
                  >
                    <SmartImage src={src} alt="" className="h-full w-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-3">
              <Rating value={view.rating} count={view.reviewCount} />
              {view.sku && <span className="text-xs text-forest/40">SKU: {view.sku}</span>}
            </div>
            <h1 className="mt-3 font-serif text-3xl font-semibold text-forest md:text-4xl">{view.name}</h1>

            {view.description && <p className="mt-5 leading-relaxed text-forest/75">{view.description}</p>}

            {/* Colour variants */}
            {view.colors.length > 0 && (
              <div className="mt-7">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forest/60">
                  Colour
                  <span className="font-normal normal-case tracking-normal text-forest/45">
                    · {view.colors[activeColor]?.name}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {view.colors.map((c, i) => (
                    <button
                      key={c.name + i}
                      onClick={() => { setActiveColor(i); setActiveImg(0) }}
                      aria-label={c.name}
                      aria-pressed={activeColor === i}
                      title={c.name}
                      className={cn(
                        'relative flex h-10 w-10 items-center justify-center rounded-full border transition-all',
                        activeColor === i ? 'border-gold ring-2 ring-gold/30' : 'border-forest/20 hover:border-forest/50',
                      )}
                    >
                      <span className="h-7 w-7 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                      {activeColor === i && (
                        <Check className="absolute h-4 w-4 text-white mix-blend-difference" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Enquiry actions */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Button to={whatsappLink(enquiryMessage)} external variant="primary" size="lg" className="w-full">
                <MessageCircle className="h-4 w-4" /> Enquire on WhatsApp
              </Button>
              <Button to="/consultation" variant="forest" size="lg" className="w-full">
                Request a Quote
              </Button>
            </div>
            <p className="mt-3 text-xs text-forest/50">
              Made to order · Our design team will confirm availability, finishes, and pricing for your space.
            </p>

            {/* Trust row */}
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-forest/10 pt-6 text-center text-xs text-forest/60">
              {[
                { icon: Ruler, label: 'Made to measure' },
                { icon: Truck, label: 'Pan-India delivery' },
                { icon: ShieldCheck, label: 'Quality warranty' },
              ].map((t) => (
                <div key={t.label} className="flex flex-col items-center gap-2">
                  <t.icon className="h-5 w-5 text-gold" />
                  {t.label}
                </div>
              ))}
            </div>

            {/* Specifications */}
            {view.specifications.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-forest/60">Specifications</h3>
                <dl className="divide-y divide-forest/10 border-y border-forest/10">
                  {view.specifications.map((s) => (
                    <div key={s.label} className="flex justify-between gap-4 py-3 text-sm">
                      <dt className="text-forest/55">{s.label}</dt>
                      <dd className="font-medium text-forest">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </Section>

      {related.length > 0 && (
        <Section tone="white">
          <SectionHeading eyebrow="You May Also Like" title="Related Products" align="left" />
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </Section>
      )}
    </>
  )
}
