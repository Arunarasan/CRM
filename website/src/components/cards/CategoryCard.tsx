import { Link } from 'react-router-dom'
import type { Category } from '@/types'
import { Icon } from '@/lib/icons'

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      to={`/products/${category.slug}`}
      className="group flex min-w-[132px] flex-col items-center gap-3 border border-forest/10 bg-white px-4 py-6 text-center shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-gold hover:bg-forest"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold transition-colors group-hover:border-gold group-hover:bg-gold/10">
        <Icon name={category.icon} className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <span className="text-sm font-medium text-forest transition-colors group-hover:text-ivory">
        {category.name}
      </span>
    </Link>
  )
}
