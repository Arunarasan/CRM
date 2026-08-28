import type { Stat } from '@/types'
import { Icon } from '@/lib/icons'

/** A single statistic row used in the hero floating card. */
export function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center lg:flex-row lg:gap-4 lg:text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold sm:h-11 sm:w-11">
        <Icon name={stat.icon} className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.5} />
      </span>
      <div>
        <div className="font-serif text-xl font-semibold leading-none text-gold sm:text-2xl">{stat.value}</div>
        <div className="mt-1 text-[10px] uppercase tracking-wide text-ivory/70 sm:text-xs">{stat.label}</div>
      </div>
    </div>
  )
}
