import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Elegant "in progress" page for routes whose full build lands in a later phase.
 * Keeps every navigation link valid so the site is fully explorable now.
 */
export default function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <section className="bg-ivory">
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <span className="eyebrow">
          <span className="rule-gold" />
          JB Decor
          <span className="rule-gold" />
        </span>
        <h1 className="mt-5 font-serif text-4xl font-semibold text-forest md:text-5xl">{title}</h1>
        <p className="mt-4 max-w-md text-forest/60">
          {note ?? 'This experience is being crafted with the same care as our interiors. Check back soon.'}
        </p>
        <div className="mt-8">
          <Button to="/" variant="outlineForest">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </div>
      </div>
    </section>
  )
}
