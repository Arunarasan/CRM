import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useToastStore } from '@/store/toast'
import { cn } from '@/lib/utils'

const iconFor = { success: CheckCircle2, error: XCircle, info: Info }

/** Renders active toasts, bottom-center. Mounted once in the layout. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const Icon = iconFor[t.variant]
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-center gap-3 border bg-forest px-4 py-3 text-sm text-ivory shadow-card-hover animate-fade-up',
              t.variant === 'error' ? 'border-red-400/40' : 'border-gold/40',
            )}
          >
            <Icon className={cn('h-5 w-5', t.variant === 'error' ? 'text-red-300' : 'text-gold')} />
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ivory/50 hover:text-ivory">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
