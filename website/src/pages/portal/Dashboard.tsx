import { Link } from 'react-router-dom'
import { FolderKanban, CreditCard, Wrench, Bell, FileArchive, ArrowRight } from 'lucide-react'
import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card, Skeleton } from '@/components/portal/PortalUI'
import { formatINR } from '@/lib/utils'

interface Dash {
  customerName: string
  activeProjects: number
  pendingPayment: number
  openServiceRequests: number
  unreadNotifications: number
  recentDocuments: { id: number; fileName: string; fileUrl: string }[]
}

export default function PortalDashboard() {
  const { data, loading, error, reload } = useFetch<Dash>(() => portalApi.dashboard())

  const stats = [
    { label: 'Active Projects', value: data?.activeProjects ?? 0, icon: FolderKanban, to: '/portal/projects' },
    { label: 'Pending Payment', value: formatINR(data?.pendingPayment ?? 0), icon: CreditCard, to: '/portal/invoices' },
    { label: 'Open Requests', value: data?.openServiceRequests ?? 0, icon: Wrench, to: '/portal/service-requests' },
    { label: 'Notifications', value: data?.unreadNotifications ?? 0, icon: Bell, to: '/portal/notifications' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">
          Welcome{data?.customerName ? `, ${data.customerName}` : ''}
        </h1>
        <p className="mt-1 text-forest/55">Here's a snapshot of your journey with JB Decor.</p>
      </div>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={reload}
        skeleton={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} to={s.to} className="group border border-forest/10 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 text-gold">
                  <s.icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <ArrowRight className="h-4 w-4 text-forest/20 transition-colors group-hover:text-gold" />
              </div>
              <div className="mt-4 font-serif text-2xl font-semibold text-forest">{s.value}</div>
              <div className="text-xs uppercase tracking-wide text-forest/50">{s.label}</div>
            </Link>
          ))}
        </div>
      </AsyncSection>

      {/* Recent documents */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-forest">Recent Documents</h2>
          <Link to="/portal/documents" className="text-xs font-semibold uppercase tracking-wide text-gold-dark hover:text-forest">View all</Link>
        </div>
        <AsyncSection
          loading={loading}
          error={error}
          onRetry={reload}
          empty={!!data && (!data.recentDocuments || data.recentDocuments.length === 0)}
          emptyMessage="No documents yet. Your quotations and invoices will appear here."
        >
          <Card className="divide-y divide-forest/5 p-0">
            {data?.recentDocuments?.map((d) => (
              <a key={d.id} href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-5 py-3.5 text-sm text-forest transition-colors hover:bg-ivory">
                <FileArchive className="h-4 w-4 text-gold" />
                <span className="flex-1 truncate">{d.fileName}</span>
                <ArrowRight className="h-4 w-4 text-forest/30" />
              </a>
            ))}
          </Card>
        </AsyncSection>
      </div>
    </div>
  )
}
