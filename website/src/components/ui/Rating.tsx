import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Gold star rating out of 5. */
export function Rating({
  value,
  count,
  className,
}: {
  value: number
  count?: number
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex" aria-label={`Rated ${value} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              'h-4 w-4',
              i < Math.round(value) ? 'fill-gold text-gold' : 'fill-none text-forest/25',
            )}
          />
        ))}
      </div>
      {count !== undefined && <span className="text-xs text-forest/50">({count})</span>}
    </div>
  )
}
