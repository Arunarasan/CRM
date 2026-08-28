import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Product } from '@/types'
import { SmartImage } from '@/components/ui/SmartImage'

/** Catalog card — showcase only (no pricing / cart). Links into the category → product path. */
export function ProductCard({ product }: { product: Product }) {
  const to = `/products/${product.categorySlug}/${product.slug}`

  return (
    <article className="group flex flex-col overflow-hidden border border-forest/10 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <Link to={to} className="relative block aspect-square overflow-hidden" aria-label={product.name}>
        <SmartImage
          src={product.image}
          alt={product.name}
          className="h-full w-full"
          imgClassName="group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
        <Link to={to}>
          <h3 className="line-clamp-2 font-serif text-[15px] font-semibold leading-snug text-forest transition-colors group-hover:text-gold-dark sm:text-lg">
            {product.name}
          </h3>
        </Link>
        <p className="line-clamp-2 text-xs leading-relaxed text-forest/55 sm:text-sm">
          {product.shortDescription}
        </p>
        <Link
          to={to}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-dark transition-colors group-hover:text-forest"
        >
          View Details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  )
}
