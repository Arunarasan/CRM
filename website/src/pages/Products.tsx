import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { SmartImage } from '@/components/ui/SmartImage'
import { Icon } from '@/lib/icons'
import { CTABand } from '@/components/shared/CTABand'
import { categories as categoriesSeed } from '@/data/categories'
import { products as productsSeed } from '@/data/products'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'
import { useSeo, itemListJsonLd } from '@/hooks/useSeo'
import { images } from '@/config/images'

export default function Products() {
  const categories = usePublicData(categoriesSeed, publicApi.categories)
  const products = usePublicData(productsSeed, publicApi.products)
  useSeo({
    title: 'Our Collections',
    description: 'Browse JB Decor by category — furniture, lighting, décor, curtains and more. Explore each collection and enquire for made-to-order pieces.',
    jsonLd: itemListJsonLd('JB Decor Collections',
      categories.map((c) => ({ name: c.name, path: `/products/${c.slug}` }))),
  })

  return (
    <>
      <PageHeader
        eyebrow="Browse by Category"
        title="Our Collections"
        description="Explore the collection by category — then dive in to see pieces, finishes, and colour options."
        image={images.hero.diningHall}
        crumbs={[{ label: 'Products' }]}
      />

      <Section tone="ivory">
        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => {
            const inCat = products.filter((p) => p.categorySlug === category.slug)
            const cover = inCat[0]?.image
            return (
              <Link
                key={category.id}
                to={`/products/${category.slug}`}
                className="group relative flex flex-col overflow-hidden border border-forest/10 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-forest/5">
                  {cover ? (
                    <SmartImage src={cover} alt={category.name} className="h-full w-full" imgClassName="group-hover:scale-105" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-gold">
                      <Icon name={category.icon} className="h-10 w-10" strokeWidth={1.5} />
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-forest-deep/70 via-transparent to-transparent" />
                  <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gold-dark shadow-sm">
                    <Icon name={category.icon} className="h-4.5 w-4.5" strokeWidth={1.5} />
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-between gap-2 p-3 sm:p-4">
                  <div>
                    <h3 className="font-serif text-base font-semibold text-forest transition-colors group-hover:text-gold-dark sm:text-lg">
                      {category.name}
                    </h3>
                    <p className="text-xs text-forest/50">{inCat.length} {inCat.length === 1 ? 'item' : 'items'}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-gold-dark transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            )
          })}
        </div>
      </Section>

      <CTABand />
    </>
  )
}
