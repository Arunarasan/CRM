import type { ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

/** Colored status pill; maps common CRM statuses to tones. */
export function StatusBadge({ status }: { status?: string }) {
  const s = (status || '').toUpperCase()
  const tone =
    ['PAID', 'COMPLETED', 'CONFIRMED', 'RESOLVED', 'APPROVED', 'DELIVERED'].includes(s)
      ? 'bg-green-100 text-green-800'
      : ['OVERDUE', 'CANCELLED', 'REJECTED', 'URGENT'].includes(s)
        ? 'bg-red-100 text-red-700'
        : ['PENDING', 'DRAFT', 'OPEN', 'UNPAID', 'PARTIAL', 'IN_PROGRESS'].includes(s)
          ? 'bg-amber-100 text-amber-800'
          : 'bg-forest/10 text-forest'
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', tone)}>
      {status || '—'}
    </span>
  )
}

/** Gold progress bar. */
export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-forest/10">
      <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${v}%` }} />
    </div>
  )
}

/** Skeleton block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-forest/10', className)} />
}

/** Card container used across portal pages. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('border border-forest/10 bg-white p-5 shadow-card', className)}>{children}</div>
}

/** Loading / error / empty wrapper for a fetched section. */
export function AsyncSection({
  loading,
  error,
  empty,
  emptyMessage,
  onRetry,
  skeleton,
  children,
}: {
  loading: boolean
  error: string | null
  empty?: boolean
  emptyMessage?: string
  onRetry?: () => void
  skeleton?: ReactNode
  children: ReactNode
}) {
  if (loading) {
    return <>{skeleton ?? (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    )}</>
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 border border-dashed border-red-200 bg-red-50/40 px-6 py-16 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-forest/70">{error}</p>
        {onRetry && <Button variant="outlineForest" onClick={onRetry}><RotateCcw className="h-4 w-4" /> Try Again</Button>}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="border border-dashed border-forest/15 bg-white/50 px-6 py-16 text-center text-sm text-forest/55">
        {emptyMessage ?? 'Nothing to show yet.'}
      </div>
    )
  }
  return <>{children}</>
}
