import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Lock, CreditCard, Smartphone, Landmark, Store, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Input, Textarea } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { SmartImage } from '@/components/ui/SmartImage'
import { formatINR, cn } from '@/lib/utils'
import { useCart, useCartSubtotal, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '@/store/cart'
import { publicApi } from '@/api/publicApi'

const paymentMethods = [
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, note: 'Secure payment via gateway' },
  { id: 'upi', label: 'UPI', icon: Smartphone, note: 'Pay using any UPI app' },
  { id: 'netbanking', label: 'Net Banking', icon: Landmark, note: 'All major banks' },
  { id: 'cod', label: 'Pay on Delivery / Visit', icon: Store, note: 'Settle at handover' },
]

export default function Checkout() {
  const { items, clear } = useCart()
  const subtotal = useCartSubtotal()
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE
  const total = subtotal + delivery
  const [method, setMethod] = useState('card')
  const [placed, setPlaced] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Creates a real CRM Order via /api/public/orders. Prices are re-resolved server-side; no raw
  // card details are collected or stored here (gateway hand-off comes with payment integration).
  const handlePlace = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    const f = new FormData(e.currentTarget)
    try {
      setSubmitting(true)
      const result = await publicApi.checkout({
        name: String(f.get('name') ?? ''),
        phone: String(f.get('phone') ?? ''),
        email: String(f.get('email') ?? ''),
        address: String(f.get('address') ?? ''),
        city: String(f.get('city') ?? ''),
        pincode: String(f.get('pincode') ?? ''),
        paymentMethod: method,
        items: items.map((i) => ({ productId: i.id, qty: i.qty })),
      })
      clear()
      setPlaced(result.orderNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong placing your order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (placed) {
    return (
      <>
        <PageHeader eyebrow="All Done" title="Order Confirmed" crumbs={[{ label: 'Checkout' }]} />
        <Section tone="ivory">
          <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-gold" />
            <h2 className="mt-6 font-serif text-3xl font-semibold text-forest">Thank you for your order!</h2>
            <p className="mt-3 text-forest/65">
              Your order <span className="font-semibold text-forest">#{placed}</span> has been received. Our team will
              be in touch with delivery details shortly.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button to="/shop" variant="outlineForest">Continue Shopping</Button>
              <Button to="/portal/orders" variant="primary">Track in My Account</Button>
            </div>
          </div>
        </Section>
      </>
    )
  }

  if (items.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Checkout" title="Checkout" crumbs={[{ label: 'Checkout' }]} />
        <Section tone="ivory">
          <EmptyState
            title="Your cart is empty"
            message="Add something you love before checking out."
            action={<Button to="/shop" variant="primary" className="mt-2">Explore the Shop</Button>}
          />
        </Section>
      </>
    )
  }

  return (
    <>
      <PageHeader eyebrow="Almost There" title="Checkout" crumbs={[{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />

      <Section tone="ivory">
        <form onSubmit={handlePlace} className="grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">
          <div className="space-y-6 sm:space-y-8">
            {/* Contact */}
            <fieldset className="border border-forest/10 bg-white p-5 sm:p-6">
              <legend className="px-2 font-serif text-lg font-semibold text-forest">Contact Information</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Full Name" name="name" required placeholder="Your full name" />
                <Input label="Phone" name="phone" type="tel" required placeholder="+91 90000 00000" />
                <Input label="Email" name="email" type="email" required placeholder="you@email.com" className="sm:col-span-2" />
              </div>
            </fieldset>

            {/* Delivery */}
            <fieldset className="border border-forest/10 bg-white p-5 sm:p-6">
              <legend className="px-2 font-serif text-lg font-semibold text-forest">Delivery Address</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Textarea label="Address" name="address" required placeholder="Street, area, landmark" className="sm:col-span-2" />
                <Input label="City" name="city" required placeholder="City" />
                <Input label="Pincode" name="pincode" required placeholder="560001" />
              </div>
            </fieldset>

            {/* Payment */}
            <fieldset className="border border-forest/10 bg-white p-5 sm:p-6">
              <legend className="px-2 font-serif text-lg font-semibold text-forest">Payment Method</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {paymentMethods.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 border p-4 transition-colors',
                      method === m.id ? 'border-gold bg-gold/5' : 'border-forest/15 hover:border-forest/40',
                    )}
                  >
                    <input type="radio" name="payment" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="accent-gold" />
                    <m.icon className="h-5 w-5 text-gold-dark" />
                    <span>
                      <span className="block text-sm font-medium text-forest">{m.label}</span>
                      <span className="block text-xs text-forest/50">{m.note}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-forest/50">
                <Lock className="h-3.5 w-3.5 text-gold" /> Payments are processed securely. We never store your card details.
              </p>
            </fieldset>

            {error && (
              <p className="flex items-center gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </p>
            )}
          </div>

          {/* Summary */}
          <aside className="h-max border border-forest/10 bg-white p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
            <h2 className="font-serif text-xl font-semibold text-forest">Your Order</h2>
            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden border border-forest/10">
                    <SmartImage src={item.image} alt={item.name} className="h-full w-full" />
                  </div>
                  <div className="flex flex-1 justify-between gap-2 text-sm">
                    <span className="text-forest/75">{item.name} × {item.qty}</span>
                    <span className="font-medium text-forest">{formatINR(item.price * item.qty)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2.5 border-t border-forest/10 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-forest/60">Subtotal</dt><dd className="font-medium text-forest">{formatINR(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-forest/60">Delivery</dt><dd className="font-medium text-forest">{delivery === 0 ? 'Free' : formatINR(delivery)}</dd></div>
              <div className="flex justify-between border-t border-forest/10 pt-2.5 text-base">
                <dt className="font-semibold text-forest">Total</dt>
                <dd className="font-serif text-xl font-semibold text-forest">{formatINR(total)}</dd>
              </div>
            </dl>
            <Button size="lg" className="mt-6 w-full" disabled={submitting}>
              {submitting ? 'Placing Order…' : 'Place Order'}
            </Button>
            <Link to="/cart" className="mt-3 block text-center text-sm text-forest/60 hover:text-gold-dark">Back to Cart</Link>
          </aside>
        </form>
      </Section>
    </>
  )
}
