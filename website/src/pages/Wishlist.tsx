import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { ProductCard } from '@/components/cards/ProductCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Heart } from 'lucide-react'
import { products } from '@/data/products'
import { useWishlist } from '@/store/wishlist'

export default function Wishlist() {
  const ids = useWishlist((s) => s.ids)
  const items = products.filter((p) => ids.includes(p.id))

  return (
    <>
      <PageHeader eyebrow="Saved for Later" title="Your Wishlist" crumbs={[{ label: 'Wishlist' }]} />
      <Section tone="ivory">
        {items.length === 0 ? (
          <EmptyState
            title="Your wishlist is waiting for something beautiful"
            message="Tap the heart on any product to save it here."
            action={<Button to="/shop" variant="primary" className="mt-2"><Heart className="h-4 w-4" /> Discover Products</Button>}
          />
        ) : (
          <>
            <p className="mb-6 text-sm text-forest/55">{items.length} item{items.length > 1 ? 's' : ''} saved</p>
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </>
        )}
      </Section>
    </>
  )
}
