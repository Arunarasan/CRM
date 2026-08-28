import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card, StatusBadge } from '@/components/portal/PortalUI'
import { Button } from '@/components/ui/Button'
import { formatINR } from '@/lib/utils'

interface Order {
  id: number
  orderNumber: string
  status: string
  total: number
  paymentStatus: string
  placedAt: string
  itemCount: number
}

export default function PortalOrders() {
  const { data, loading, error, reload } = useFetch<Order[]>(() => portalApi.orders())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">Orders</h1>
        <p className="mt-1 text-forest/55">Your shop purchases and their status.</p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}
        empty={!!data && data.length === 0}
        emptyMessage="Your orders will appear here.">
        {(!data || data.length === 0) ? (
          <div className="flex flex-col items-center gap-4 border border-dashed border-forest/15 bg-white/50 px-6 py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-gold" />
            <p className="text-sm text-forest/55">Your orders will appear here.</p>
            <Button to="/shop" variant="primary">Explore the Shop</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((o) => (
              <Card key={o.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-forest">#{o.orderNumber}</div>
                    <div className="text-xs text-forest/45">
                      {o.itemCount} item{o.itemCount === 1 ? '' : 's'}{o.placedAt ? ` · ${String(o.placedAt).slice(0, 10)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-serif text-lg font-semibold text-forest">{formatINR(o.total ?? 0)}</span>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={o.status} />
                      <StatusBadge status={o.paymentStatus} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>

      <p className="text-center text-sm text-forest/45">
        Looking for something new? <Link to="/shop" className="text-gold-dark hover:text-forest">Browse the collection</Link>
      </p>
    </div>
  )
}
