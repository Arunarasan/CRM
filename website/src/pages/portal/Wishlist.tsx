import { Heart } from 'lucide-react'
import { products } from '@/data/products'
import { useWishlist } from '@/store/wishlist'
import { ProductCard } from '@/components/cards/ProductCard'
import { Button } from '@/components/ui/Button'

export default function PortalWishlist() {
  const ids = useWishlist((s) => s.ids)
  const items = products.filter((p) => ids.includes(p.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">My Wishlist</h1>
        <p className="mt-1 text-forest/55">Pieces you've saved for later.</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 border border-dashed border-forest/15 bg-white/50 px-6 py-16 text-center">
          <Heart className="h-10 w-10 text-gold" />
          <p className="text-sm text-forest/55">Your wishlist is waiting for something beautiful.</p>
          <Button to="/products" variant="primary">Discover Products</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  )
}
