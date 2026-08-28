import { ArrowRight, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SmartImage } from '@/components/ui/SmartImage'
import { images } from '@/config/images'
import { useSite, usePageContent } from '@/hooks/useSiteSettings'

export function ConsultationCTA() {
  const site = useSite()
  const content = usePageContent('home')
  return (
    <section className="relative overflow-hidden bg-forest">
      <div className="absolute inset-0">
        <SmartImage
          src={images.consultationCta}
          alt="An elegant JB Decor interior setting"
          className="h-full w-full"
          imgClassName="h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest-deep via-forest/90 to-forest/60" />
      </div>

      <div className="container relative py-14 sm:py-20 md:py-28">
        <div className="max-w-2xl">
          <span className="eyebrow">
            <span className="rule-gold" />
            Let’s Begin
          </span>
          <h2 className="mt-4 font-serif text-[1.75rem] font-semibold leading-tight text-ivory sm:mt-5 sm:text-3xl md:text-5xl">
            {content.section('consultation_cta')?.title
              ? content.section('consultation_cta')!.title
              : <>Ready to design a space that <span className="text-gold">inspires?</span></>}
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ivory/75 sm:mt-5 sm:text-base md:text-lg">
            {content.text('consultation_cta', 'body',
              'Book a complimentary consultation with our design team. We’ll listen, sketch, and shape a vision tailored entirely to you.')}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:gap-4">
            <Button to="/consultation" variant="primary" size="lg">
              Book Consultation <ArrowRight className="h-4 w-4" />
            </Button>
            <Button to={`tel:${site.phone}`} variant="outlineGold" size="lg" external>
              <Phone className="h-4 w-4" /> {site.phone}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
