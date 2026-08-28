import { Bell, Check } from 'lucide-react'
import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card } from '@/components/portal/PortalUI'
import { cn } from '@/lib/utils'
import { toast } from '@/store/toast'

interface Notif {
  id: number
  type: string
  title: string
  body: string
  link: string
  read: boolean
  createdAt: string
}

export default function PortalNotifications() {
  const { data, loading, error, reload } = useFetch<Notif[]>(() => portalApi.notifications())

  const markRead = async (id: number) => {
    try {
      await portalApi.markNotificationRead(id)
      reload()
    } catch {
      toast('Could not update notification', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">Notifications</h1>
        <p className="mt-1 text-forest/55">Updates on your quotations, payments, and projects.</p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}
        empty={!!data && data.length === 0} emptyMessage="You're all caught up.">
        <div className="space-y-3">
          {data?.map((n) => (
            <Card key={n.id} className={cn('flex items-start gap-4', !n.read && 'border-l-4 border-l-gold')}>
              <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', n.read ? 'bg-forest/5 text-forest/40' : 'bg-gold/15 text-gold-dark')}>
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className={cn('font-medium', n.read ? 'text-forest/70' : 'text-forest')}>{n.title}</h3>
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                </div>
                {n.body && <p className="mt-0.5 text-sm text-forest/55">{n.body}</p>}
                <div className="mt-1 text-xs text-forest/35">{n.createdAt ? String(n.createdAt).slice(0, 16).replace('T', ' ') : ''}</div>
              </div>
              {!n.read && (
                <button onClick={() => markRead(n.id)} aria-label="Mark as read"
                  className="flex h-8 w-8 shrink-0 items-center justify-center border border-forest/15 text-forest/50 hover:border-gold hover:text-gold">
                  <Check className="h-4 w-4" />
                </button>
              )}
            </Card>
          ))}
        </div>
      </AsyncSection>
    </div>
  )
}
