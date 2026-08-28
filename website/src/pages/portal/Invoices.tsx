import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card, StatusBadge } from '@/components/portal/PortalUI'
import { formatINR } from '@/lib/utils'

interface Invoice {
  id: number
  invoiceNumber: string
  date: string
  dueDate: string
  status: string
  totalAmount: number
  amountPaid: number
  balanceDue: number
}

export default function PortalInvoices() {
  const { data, loading, error, reload } = useFetch<Invoice[]>(() => portalApi.invoices())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">Invoices</h1>
        <p className="mt-1 text-forest/55">Your billing history and outstanding balances.</p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}
        empty={!!data && data.length === 0} emptyMessage="No invoices yet.">
        <div className="space-y-3">
          {data?.map((inv) => (
            <Card key={inv.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-forest">{inv.invoiceNumber}</div>
                  <div className="text-xs text-forest/45">Issued {inv.date}{inv.dueDate ? ` · Due ${inv.dueDate}` : ''}</div>
                </div>
                <StatusBadge status={inv.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-forest/10 pt-4 text-sm">
                <div><div className="text-xs text-forest/45">Total</div><div className="font-semibold text-forest">{formatINR(inv.totalAmount ?? 0)}</div></div>
                <div><div className="text-xs text-forest/45">Paid</div><div className="font-semibold text-green-700">{formatINR(inv.amountPaid ?? 0)}</div></div>
                <div><div className="text-xs text-forest/45">Balance</div><div className="font-semibold text-forest">{formatINR(inv.balanceDue ?? 0)}</div></div>
              </div>
            </Card>
          ))}
        </div>
      </AsyncSection>
    </div>
  )
}
