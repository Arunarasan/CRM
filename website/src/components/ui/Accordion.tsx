import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FaqItem {
  question: string
  answer: string
}

/** Lightweight, accessible FAQ accordion. */
export function Accordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="divide-y divide-forest/10 border-y border-forest/10">
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="font-serif text-lg font-medium text-forest">{item.question}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold">
                {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
            </button>
            <div
              className={cn(
                'grid overflow-hidden transition-all duration-300',
                isOpen ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl text-sm leading-relaxed text-forest/65">{item.answer}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
