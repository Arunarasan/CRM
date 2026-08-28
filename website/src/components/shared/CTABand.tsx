import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/** Reusable "book a consultation" call-to-action band for the foot of internal pages. */
export function CTABand({
  title = 'Ready to begin your project?',
  subtitle = 'Book a complimentary consultation and let our designers bring your vision to life.',
  primaryText = 'Book a Consultation',
  primaryTo = '/consultation',
}: {
  title?: string
  subtitle?: string
  primaryText?: string
  primaryTo?: string
}) {
  return (
    <section className="bg-forest-deep py-16 md:py-20">
      <div className="container flex flex-col items-center gap-6 text-center">
        <span className="rule-gold" />
        <h2 className="max-w-2xl font-serif text-3xl font-semibold text-ivory md:text-4xl">{title}</h2>
        <p className="max-w-xl text-ivory/70">{subtitle}</p>
        <Button to={primaryTo} variant="primary" size="lg">
          {primaryText} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}
