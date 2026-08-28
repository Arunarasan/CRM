import { SearchX } from 'lucide-react'
import type { ReactNode } from 'react'

/** Elegant empty state for filtered lists with no results. */
export function EmptyState({
  title = 'Nothing here yet',
  message,
  action,
}: {
  title?: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 border border-dashed border-forest/15 bg-white/50 px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 text-gold">
        <SearchX className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <h3 className="font-serif text-xl font-semibold text-forest">{title}</h3>
      {message && <p className="max-w-sm text-sm text-forest/55">{message}</p>}
      {action}
    </div>
  )
}
