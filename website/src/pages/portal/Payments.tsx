import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card, StatusBadge } from '@/components/portal/PortalUI'
import { formatINR } from '@/lib/utils'

interface Payment {
  id: number
  paymentNumber: string
  date: string
  amount: number
  method: string
  status: string
}

export default function PortalPayments() {
  const { data, loading, error, reload } = useFetch<Payment[]>(() => portalApi.payments())
  const total = data?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">Payments</h1>
        <p className="mt-1 text-forest/55">A record of every payment you've made.</p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}
        empty={!!data && data.length === 0} emptyMessage="No payments recorded yet.">
        <>
          {data && data.length > 0 && (
            <Card className="mb-4 flex items-center justify-between bg-forest text-ivory">
              <span className="text-sm text-ivory/70">Total Paid</span>
              <span className="font-serif text-2xl font-semibold text-gold">{formatINR(total)}</span>
            </Card>
          )}
          <Card className="divide-y divide-forest/5 p-0">
            {data?.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <div className="font-medium text-forest">{p.paymentNumber || 'Payment'}</div>
                  <div className="text-xs text-forest/45">{p.date}{p.method ? ` · ${p.method}` : ''}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-forest">{formatINR(p.amount ?? 0)}</span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </Card>
        </>
      </AsyncSection>
    </div>
  )
}
