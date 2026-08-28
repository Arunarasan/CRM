import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProductCard } from '@/components/cards/ProductCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { products as productsSeed } from '@/data/products'
import { categories as categoriesSeed } from '@/data/categories'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'
import { useSeo } from '@/hooks/useSeo'
import { images } from '@/config/images'
import { cn } from '@/lib/utils'

type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'rating'

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
  { key: 'rating', label: 'Top Rated' },
]

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(params.get('category') ?? 'all')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [minRating, setMinRating] = useState(0)
  const [maxPrice, setMaxPrice] = useState(100000)
  const [sort, setSort] = useState<SortKey>('featured')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useSeo({ title: 'Shop the Collection', description: 'Premium furniture, lighting, and décor to complete every space — handpicked by JB Decor.' })
  const products = usePublicData(productsSeed, publicApi.products)
  const categories = usePublicData(categoriesSeed, publicApi.categories)

  useEffect(() => {
    setCategory(params.get('category') ?? 'all')
  }, [params])

  const results = useMemo(() => {
    let list = products.filter((p) => {
      if (category !== 'all' && p.categorySlug !== category) return false
      if (inStockOnly && !p.inStock) return false
      if (minRating && p.rating < minRating) return false
      if ((p.discountPrice ?? p.price) > maxPrice) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    const price = (p: (typeof products)[number]) => p.discountPrice ?? p.price
    switch (sort) {
      case 'price-asc': list = [...list].sort((a, b) => price(a) - price(b)); break
      case 'price-desc': list = [...list].sort((a, b) => price(b) - price(a)); break
      case 'rating': list = [...list].sort((a, b) => b.rating - a.rating); break
      case 'newest': list = [...list].sort((a, b) => b.id - a.id); break
      default: list = [...list].sort((a, b) => Number(b.featured) - Number(a.featured))
    }
    return list
  }, [products, category, inStockOnly, minRating, maxPrice, search, sort])

  const setCat = (slug: string) => {
    setCategory(slug)
    const next = new URLSearchParams(params)
    if (slug === 'all') next.delete('category')
    else next.set('category', slug)
    setParams(next, { replace: true })
  }

  const Filters = (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-forest/60">Category</h3>
        <ul className="space-y-1">
          {[{ name: 'All Products', slug: 'all' }, ...categories].map((c) => (
            <li key={c.slug}>
              <button
                onClick={() => setCat(c.slug)}
                className={cn(
                  'w-full text-left text-sm transition-colors',
                  category === c.slug ? 'font-semibold text-gold-dark' : 'text-forest/70 hover:text-forest',
                )}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-forest/60">
          Max Price · ₹{maxPrice.toLocaleString('en-IN')}
        </h3>
        <input
          type="range" min={2000} max={100000} step={1000} value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-gold"
          aria-label="Maximum price"
        />
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-forest/60">Rating</h3>
        <div className="flex flex-wrap gap-2">
          {[0, 3, 4, 5].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(r)}
              className={cn(
                'border px-3 py-1.5 text-xs transition-colors',
                minRating === r ? 'border-gold bg-gold text-forest' : 'border-forest/15 text-forest/70 hover:border-forest',
              )}
            >
              {r === 0 ? 'Any' : `${r}★ +`}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 text-sm text-forest/75">
        <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-4 w-4 accent-gold" />
        In stock only
      </label>
    </div>
  )

  return (
    <>
      <PageHeader
        eyebrow="Premium Décor & Furniture"
        title="Shop the Collection"
        description="Handpicked lighting, furniture, and décor to complete every space with intention."
        image={images.hero.diningHall}
        crumbs={[{ label: 'Shop' }]}
      />

      <section className="bg-ivory py-12 md:py-16">
        <div className="container grid gap-10 lg:grid-cols-[240px_1fr]">
          {/* Desktop filters */}
          <aside className="hidden lg:block">{Filters}</aside>

          <div>
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  aria-label="Search products"
                  className="w-full border border-forest/15 bg-white py-2.5 pl-10 pr-4 text-sm text-forest placeholder:text-forest/35 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
              <button
                onClick={() => setFiltersOpen(true)}
                className="flex items-center gap-2 border border-forest/15 bg-white px-4 py-2.5 text-sm text-forest lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </button>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort products"
                className="border border-forest/15 bg-white px-4 py-2.5 text-sm text-forest focus:border-gold focus:outline-none"
              >
                {sortOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>

            <p className="mb-5 text-sm text-forest/55">{results.length} products</p>

            {results.length === 0 ? (
              <EmptyState title="No products match your filters" message="Try widening your price range or clearing a filter." />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-forest-deep/60" onClick={() => setFiltersOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm overflow-y-auto bg-ivory p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-forest">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X className="h-6 w-6 text-forest" /></button>
            </div>
            {Filters}
          </div>
        </div>
      )}
    </>
  )
}
