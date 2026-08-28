import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SmartImage } from '@/components/ui/SmartImage'
import { images } from '@/config/images'

export function DesignYourSpace() {
  return (
    <section className="bg-forest py-12 sm:py-16 md:py-24">
      <div className="container">
        <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-2">
          <div className="max-w-lg">
            <span className="eyebrow">
              <span className="rule-gold" />
              Design Your Dream Space
            </span>
            <h2 className="mt-4 font-serif text-[1.75rem] font-semibold leading-tight text-ivory sm:mt-5 sm:text-3xl md:text-4xl">
              Visualize. Customize. <span className="text-gold">Perfect.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ivory/70 sm:mt-5 sm:text-base">
              Explore personalized interior concepts with our interactive Design Studio. Choose a
              room, a style, a palette, and the pieces that speak to you — and see it come together
              before a single wall is touched.
            </p>
            <div className="mt-8">
              <Button to="/design-studio" variant="primary" size="lg">
                Start Designing <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-3 border border-gold/25" aria-hidden />
            <SmartImage
              src={images.designStudio}
              alt="A luxury living room concept visualized in the JB Decor design studio"
              className="relative aspect-[4/3] w-full"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
