import { whyChooseFeatures } from '@/data/siteContent'
import { Icon } from '@/lib/icons'
import { usePageContent } from '@/hooks/useSiteSettings'

export function WhyChooseUs() {
  const content = usePageContent('home')
  return (
    <section className="bg-forest-deep py-12 sm:py-16 md:py-20">
      <div className="container">
        <div className="mb-8 text-center sm:mb-12">
          <span className="eyebrow justify-center">
            <span className="rule-gold" />
            {content.text('why_choose_us', 'subtitle', 'The JB Decor Promise')}
            <span className="rule-gold" />
          </span>
          <h2 className="mt-4 font-serif text-[1.75rem] font-semibold text-ivory sm:text-3xl md:text-4xl">
            {content.text('why_choose_us', 'title', 'Why Choose JB Decor')}
          </h2>
        </div>

        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3">
          {whyChooseFeatures.map((feature) => (
            <div key={feature.id} className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold">
                <Icon name={feature.icon} className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold text-gold">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ivory/70">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
