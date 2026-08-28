import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { ProductCard } from '@/components/cards/ProductCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { CTABand } from '@/components/shared/CTABand'
import { Button } from '@/components/ui/Button'
import Placeholder from '@/pages/Placeholder'
import { products as productsSeed } from '@/data/products'
import { categories as categoriesSeed } from '@/data/categories'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'
import { useSeo } from '@/hooks/useSeo'
import { images } from '@/config/images'
import { cn } from '@/lib/utils'

export default function CategoryProducts() {
  const { category: categorySlug = '' } = useParams()
  const [search, setSearch] = useState('')

  const categories = usePublicData(categoriesSeed, publicApi.categories)
  const products = usePublicData(productsSeed, publicApi.products)

  const category = categories.find((c) => c.slug === categorySlug)
  useSeo({
    title: category ? `${category.name} — Collection` : 'Collection',
    description: category ? `Explore JB Decor's ${category.name.toLowerCase()} collection. Made-to-order pieces with a range of finishes and colours.` : undefined,
  })

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(
      (p) => p.categorySlug === categorySlug && (!q || p.name.toLowerCase().includes(q) || p.shortDescription.toLowerCase().includes(q)),
    )
  }, [products, categorySlug, search])

  if (!category) {
    return (
      <Placeholder
        title="Collection Not Found"
        note="That category doesn’t exist — browse all of our collections instead."
      />
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Collection"
        title={category.name}
        description={`Browse our ${category.name.toLowerCase()} — each piece is made to order with a choice of finishes and colours.`}
        image={images.hero.diningHall}
        crumbs={[{ label: 'Products', to: '/products' }, { label: category.name }]}
      />

      <Section tone="ivory">
        {/* Category switcher rail */}
        <div className="no-scrollbar -mx-5 mb-8 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
          <Link
            to="/products"
            className="shrink-0 border border-forest/15 bg-white px-4 py-2 text-sm text-forest/70 transition-colors hover:border-gold hover:text-gold-dark"
          >
            All Collections
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/products/${c.slug}`}
              className={cn(
                'shrink-0 border px-4 py-2 text-sm transition-colors',
                c.slug === categorySlug
                  ? 'border-gold bg-gold text-forest'
                  : 'border-forest/15 bg-white text-forest/70 hover:border-gold hover:text-gold-dark',
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full min-w-[200px] sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${category.name.toLowerCase()}…`}
              aria-label="Search products"
              className="w-full border border-forest/15 bg-white py-2.5 pl-10 pr-4 text-sm text-forest placeholder:text-forest/35 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <p className="text-sm text-forest/55">{results.length} {results.length === 1 ? 'item' : 'items'}</p>
        </div>

        {results.length === 0 ? (
          <EmptyState
            title="Nothing in this collection yet"
            message="New pieces are added regularly — reach out and we’ll source exactly what you need."
            action={<Button to="/consultation" variant="primary" className="mt-2">Request a Piece</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {results.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </Section>

      <CTABand />
    </>
  )
}
