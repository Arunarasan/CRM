import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card, StatusBadge } from '@/components/portal/PortalUI'
import { formatINR } from '@/lib/utils'

interface Quotation {
  id: number
  quotationNumber: string
  date: string
  status: string
  grandTotal: number
}

export default function PortalQuotations() {
  const { data, loading, error, reload } = useFetch<Quotation[]>(() => portalApi.quotations())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">Quotations</h1>
        <p className="mt-1 text-forest/55">Every proposal we've prepared for you.</p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}
        empty={!!data && data.length === 0} emptyMessage="No quotations yet.">
        <Card className="divide-y divide-forest/5 p-0">
          {data?.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="font-medium text-forest">{q.quotationNumber}</div>
                <div className="text-xs text-forest/45">{q.date}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-serif text-lg font-semibold text-forest">{formatINR(q.grandTotal ?? 0)}</span>
                <StatusBadge status={q.status} />
              </div>
            </div>
          ))}
        </Card>
      </AsyncSection>
    </div>
  )
}
