import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Section, SectionHeading } from '@/components/ui/Section'
import { featuredProducts as featuredSeed } from '@/data/products'
import { ProductCard } from '@/components/cards/ProductCard'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'

export function FeaturedProducts() {
  const featuredProducts = usePublicData(featuredSeed, publicApi.featuredProducts)
  return (
    <Section tone="ivory">
      <SectionHeading
        eyebrow="Curated Collection"
        title="Featured Products"
        align="left"
        action={
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-dark transition-colors hover:text-forest"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {featuredProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </Section>
  )
}
