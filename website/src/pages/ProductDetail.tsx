import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, ShoppingBag, Minus, Plus, Truck, ShieldCheck, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section, SectionHeading } from '@/components/ui/Section'
import { SmartImage } from '@/components/ui/SmartImage'
import { Rating } from '@/components/ui/Rating'
import { Button } from '@/components/ui/Button'
import { ProductCard } from '@/components/cards/ProductCard'
import Placeholder from '@/pages/Placeholder'
import { getProduct, products } from '@/data/products'
import { getProductDetail } from '@/data/productDetails'
import { categories } from '@/data/categories'
import { formatINR, cn } from '@/lib/utils'
import { useCart } from '@/store/cart'
import { useWishlist } from '@/store/wishlist'
import { toast } from '@/store/toast'

export default function ProductDetail() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const product = getProduct(slug)
  const addToCart = useCart((s) => s.add)
  const wished = useWishlist((s) => (product ? s.ids.includes(product.id) : false))
  const toggleWish = useWishlist((s) => s.toggle)
  const [qty, setQty] = useState(1)
  const [activeImg, setActiveImg] = useState(0)

  if (!product) return <Placeholder title="Product Not Found" note="This product may have sold out or moved." />

  const detail = getProductDetail(product)
  const category = categories.find((c) => c.slug === product.categorySlug)
  const related = products.filter((p) => p.categorySlug === product.categorySlug && p.id !== product.id).slice(0, 4)
  const unit = product.discountPrice ?? product.price

  const handleAdd = () => {
    addToCart(product, qty)
    toast(`${product.name} added to cart`)
  }
  const handleBuyNow = () => {
    addToCart(product, qty)
    navigate('/checkout')
  }

  return (
    <>
      <PageHeader
        eyebrow={category?.name ?? 'Shop'}
        title={product.name}
        crumbs={[{ label: 'Shop', to: '/shop' }, { label: product.name }]}
      />

      <Section tone="ivory">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          {/* Gallery */}
          <div>
            <div className="group relative aspect-square overflow-hidden border border-forest/10 bg-white">
              <SmartImage
                src={detail.gallery[activeImg]}
                alt={`${product.name} view ${activeImg + 1}`}
                className="h-full w-full"
                imgClassName="transition-transform duration-500 group-hover:scale-125"
              />
            </div>
            <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto">
              {detail.gallery.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  aria-label={`View image ${i + 1}`}
                  className={cn(
                    'h-20 w-20 shrink-0 overflow-hidden border transition-colors',
                    activeImg === i ? 'border-gold' : 'border-forest/15 hover:border-forest/40',
                  )}
                >
                  <SmartImage src={src} alt="" className="h-full w-full" />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-3">
              <Rating value={product.rating} count={product.reviewCount} />
              <span className="text-xs text-forest/40">SKU: {product.sku}</span>
            </div>
            <h1 className="mt-3 font-serif text-3xl font-semibold text-forest md:text-4xl">{product.name}</h1>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-serif text-3xl font-semibold text-forest">{formatINR(unit)}</span>
              {product.discountPrice && (
                <span className="text-lg text-forest/40 line-through">{formatINR(product.price)}</span>
              )}
            </div>

            <div className={cn('mt-3 inline-flex items-center gap-2 text-sm', product.inStock ? 'text-green-700' : 'text-red-600')}>
              <span className={cn('h-2 w-2 rounded-full', product.inStock ? 'bg-green-600' : 'bg-red-500')} />
              {product.inStock ? 'In Stock' : 'Currently Sold Out'}
            </div>

            <p className="mt-5 leading-relaxed text-forest/75">{detail.description}</p>

            {/* Quantity + actions */}
            {product.inStock && (
              <div className="mt-7 space-y-3 sm:mt-8">
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-forest/15">
                    <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" className="flex h-12 w-12 items-center justify-center text-forest hover:text-gold">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center font-medium text-forest">{qty}</span>
                    <button onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity" className="flex h-12 w-12 items-center justify-center text-forest hover:text-gold">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => { toggleWish(product.id); toast(wished ? 'Removed from wishlist' : 'Added to wishlist', 'info') }}
                    aria-label="Toggle wishlist"
                    className={cn(
                      'flex h-12 w-12 items-center justify-center border transition-colors',
                      wished ? 'border-gold bg-gold/10 text-gold-dark' : 'border-forest/15 text-forest hover:border-gold hover:text-gold',
                    )}
                  >
                    <Heart className={cn('h-5 w-5', wished && 'fill-gold-dark')} />
                  </button>
                  <span className="text-sm text-forest/50">Quantity</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={handleAdd} variant="forest" size="lg" className="w-full">
                    <ShoppingBag className="h-4 w-4" /> Add to Cart
                  </Button>
                  <Button onClick={handleBuyNow} variant="primary" size="lg" className="w-full">
                    Buy Now
                  </Button>
                </div>
              </div>
            )}

            {/* Trust row */}
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-forest/10 pt-6 text-center text-xs text-forest/60">
              {[
                { icon: Truck, label: 'Free delivery over ₹50k' },
                { icon: ShieldCheck, label: 'Quality warranty' },
                { icon: RotateCcw, label: '7-day returns' },
              ].map((t) => (
                <div key={t.label} className="flex flex-col items-center gap-2">
                  <t.icon className="h-5 w-5 text-gold" />
                  {t.label}
                </div>
              ))}
            </div>

            {/* Specifications */}
            <div className="mt-8">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-forest/60">Specifications</h3>
              <dl className="divide-y divide-forest/10 border-y border-forest/10">
                {detail.specifications.map((s) => (
                  <div key={s.label} className="flex justify-between gap-4 py-3 text-sm">
                    <dt className="text-forest/55">{s.label}</dt>
                    <dd className="font-medium text-forest">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </Section>

      {related.length > 0 && (
        <Section tone="white">
          <SectionHeading eyebrow="You May Also Like" title="Related Products" align="left" />
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </Section>
      )}
    </>
  )
}
