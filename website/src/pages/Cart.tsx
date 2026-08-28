import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { SmartImage } from '@/components/ui/SmartImage'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatINR } from '@/lib/utils'
import { useCart, useCartSubtotal, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '@/store/cart'

export default function Cart() {
  const { items, setQty, remove } = useCart()
  const subtotal = useCartSubtotal()
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE
  const total = subtotal + delivery

  return (
    <>
      <PageHeader eyebrow="Your Selection" title="Shopping Cart" crumbs={[{ label: 'Cart' }]} />

      <Section tone="ivory">
        {items.length === 0 ? (
          <EmptyState
            title="Your cart is waiting for something beautiful"
            message="Browse our collection and add pieces you love."
            action={<Button to="/shop" variant="primary" className="mt-2"><ShoppingBag className="h-4 w-4" /> Explore the Shop</Button>}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* Items */}
            <div className="divide-y divide-forest/10 border border-forest/10 bg-white">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 sm:p-5">
                  <Link to={`/shop/${item.slug}`} className="h-20 w-20 shrink-0 overflow-hidden border border-forest/10 sm:h-24 sm:w-24">
                    <SmartImage src={item.image} alt={item.name} className="h-full w-full" />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link to={`/shop/${item.slug}`} className="line-clamp-2 font-serif text-base font-semibold text-forest hover:text-gold-dark sm:text-lg">
                          {item.name}
                        </Link>
                        <div className="text-xs text-forest/40">SKU: {item.sku}</div>
                      </div>
                      <button onClick={() => remove(item.id)} aria-label="Remove item" className="text-forest/40 transition-colors hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-end justify-between pt-3">
                      <div className="flex items-center border border-forest/15">
                        <button onClick={() => setQty(item.id, item.qty - 1)} aria-label="Decrease" className="flex h-9 w-9 items-center justify-center text-forest hover:text-gold">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-forest">{item.qty}</span>
                        <button onClick={() => setQty(item.id, item.qty + 1)} aria-label="Increase" className="flex h-9 w-9 items-center justify-center text-forest hover:text-gold">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-forest">{formatINR(item.price * item.qty)}</div>
                        <div className="text-xs text-forest/45">{formatINR(item.price)} each</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <aside className="h-max border border-forest/10 bg-white p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
              <h2 className="font-serif text-xl font-semibold text-forest">Order Summary</h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-forest/60">Subtotal</dt><dd className="font-medium text-forest">{formatINR(subtotal)}</dd></div>
                <div className="flex justify-between">
                  <dt className="text-forest/60">Delivery</dt>
                  <dd className="font-medium text-forest">{delivery === 0 ? 'Free' : formatINR(delivery)}</dd>
                </div>
                {delivery > 0 && (
                  <p className="text-xs text-forest/45">
                    Add {formatINR(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery.
                  </p>
                )}
                <div className="flex justify-between border-t border-forest/10 pt-3 text-base">
                  <dt className="font-semibold text-forest">Total</dt>
                  <dd className="font-serif text-xl font-semibold text-forest">{formatINR(total)}</dd>
                </div>
              </dl>
              <Button to="/checkout" variant="primary" size="lg" className="mt-6 w-full">
                Checkout <ArrowRight className="h-4 w-4" />
              </Button>
              <Link to="/shop" className="mt-3 block text-center text-sm text-forest/60 transition-colors hover:text-gold-dark">
                Continue Shopping
              </Link>
            </aside>
          </div>
        )}
      </Section>
    </>
  )
}
