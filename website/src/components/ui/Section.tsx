import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'ivory' | 'white' | 'forest' | 'forestDeep'

const toneClasses: Record<Tone, string> = {
  ivory: 'bg-ivory text-forest',
  white: 'bg-white text-forest',
  forest: 'bg-forest text-ivory',
  forestDeep: 'bg-forest-deep text-ivory',
}

/**
 * A full-width section with a brand-controlled background tone. Using named tones
 * (rather than ad-hoc colors) keeps the 60/25/10/5 ivory-to-forest rhythm structural,
 * so the page alternates light and dark intentionally.
 */
export function Section({
  tone = 'ivory',
  className,
  children,
  id,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section id={id} className={cn('py-12 sm:py-16 md:py-24', toneClasses[tone], className)}>
      <div className="container">{children}</div>
    </section>
  )
}

/** Centered section heading with eyebrow + optional "view all" action. */
export function SectionHeading({
  eyebrow,
  title,
  align = 'center',
  onDark = false,
  action,
}: {
  eyebrow?: string
  title: string
  align?: 'center' | 'left'
  onDark?: boolean
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-3 sm:mb-10 sm:gap-4 md:mb-12',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        action && 'md:flex-row md:items-end md:justify-between md:text-left',
      )}
    >
      <div className={cn('flex flex-col gap-2.5 sm:gap-3', align === 'center' && !action && 'items-center')}>
        {eyebrow && (
          <span className="eyebrow">
            <span className="rule-gold" />
            {eyebrow}
          </span>
        )}
        <h2
          className={cn(
            'max-w-2xl text-[1.75rem] font-semibold leading-[1.15] sm:text-3xl md:text-4xl lg:text-[2.75rem]',
            onDark ? 'text-ivory' : 'text-forest',
          )}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}
