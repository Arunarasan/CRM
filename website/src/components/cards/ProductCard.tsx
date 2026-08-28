import { Link } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
import type { Product } from '@/types'
import { SmartImage } from '@/components/ui/SmartImage'
import { Rating } from '@/components/ui/Rating'
import { formatINR, cn } from '@/lib/utils'
import { useCart } from '@/store/cart'
import { useWishlist } from '@/store/wishlist'
import { toast } from '@/store/toast'

export function ProductCard({ product }: { product: Product }) {
  const addToCart = useCart((s) => s.add)
  const wished = useWishlist((s) => s.ids.includes(product.id))
  const toggleWish = useWishlist((s) => s.toggle)

  return (
    <article className="group flex flex-col overflow-hidden border border-forest/10 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <Link
        to={`/shop/${product.slug}`}
        className="relative block aspect-square overflow-hidden"
        aria-label={product.name}
      >
        <SmartImage
          src={product.image}
          alt={product.name}
          className="h-full w-full"
          imgClassName="group-hover:scale-105"
        />
        {product.discountPrice && (
          <span className="absolute left-3 top-3 bg-gold px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-forest">
            Sale
          </span>
        )}
        {!product.inStock && (
          <span className="absolute right-3 top-3 bg-forest/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ivory">
            Sold Out
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
        <Link to={`/shop/${product.slug}`}>
          <h3 className="line-clamp-2 font-serif text-[15px] font-semibold leading-snug text-forest transition-colors group-hover:text-gold-dark sm:text-lg">
            {product.name}
          </h3>
        </Link>
        <Rating value={product.rating} count={product.reviewCount} />

        <div className="mt-1.5 flex items-end justify-between gap-2 sm:mt-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-semibold text-forest sm:text-lg">
              {formatINR(product.discountPrice ?? product.price)}
            </span>
            {product.discountPrice && (
              <span className="text-xs text-forest/40 line-through sm:text-sm">{formatINR(product.price)}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={wished}
              onClick={() => {
                toggleWish(product.id)
                toast(wished ? 'Removed from wishlist' : 'Added to wishlist', 'info')
              }}
              className={cn(
                'flex h-8 w-8 items-center justify-center border transition-colors sm:h-9 sm:w-9',
                wished
                  ? 'border-gold bg-gold/10 text-gold-dark'
                  : 'border-forest/15 text-forest hover:border-gold hover:text-gold',
              )}
            >
              <Heart className={cn('h-4 w-4', wished && 'fill-gold-dark')} />
            </button>
            <button
              type="button"
              aria-label="Add to cart"
              disabled={!product.inStock}
              onClick={() => {
                addToCart(product)
                toast(`${product.name} added to cart`)
              }}
              className="flex h-8 w-8 items-center justify-center border border-forest/15 text-forest transition-colors hover:border-gold hover:bg-gold hover:text-forest disabled:opacity-40 sm:h-9 sm:w-9"
            >
              <ShoppingBag className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
