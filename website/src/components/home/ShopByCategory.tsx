import { categories as categoriesSeed } from '@/data/categories'
import { CategoryCard } from '@/components/cards/CategoryCard'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'

export function ShopByCategory() {
  const categories = usePublicData(categoriesSeed, publicApi.categories)
  return (
    <section className="bg-ivory py-14 md:py-16">
      <div className="container">
        <div className="mb-8 flex items-center justify-center gap-4">
          <span className="rule-gold" />
          <h2 className="text-center font-serif text-2xl font-semibold uppercase tracking-wide text-forest">
            Browse by Category
          </h2>
          <span className="rule-gold" />
        </div>

        {/* Desktop: wrapped grid · Mobile: horizontal scroll rail */}
        <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 lg:grid-cols-10 lg:gap-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>
    </section>
  )
}
