import { Target, Eye, Check } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section, SectionHeading } from '@/components/ui/Section'
import { SmartImage } from '@/components/ui/SmartImage'
import { TestimonialCard } from '@/components/cards/TestimonialCard'
import { CTABand } from '@/components/shared/CTABand'
import { images } from '@/config/images'
import { heroStats } from '@/data/heroSlides'
import { testimonials, whyChooseFeatures } from '@/data/siteContent'
import { Icon } from '@/lib/icons'
import { useSeo } from '@/hooks/useSeo'
import { usePageContent } from '@/hooks/useSiteSettings'

const philosophy = [
  'Design that serves the way you actually live',
  'Honest materials, finished with real craft',
  'Transparency at every milestone',
  'A calm, considered experience end to end',
]

export default function About() {
  useSeo({ title: 'About Us', description: 'For over 16 years, JB Decor has designed and delivered interiors that balance elegance, function, and craftsmanship.' })
  const content = usePageContent('about')
  return (
    <>
      <PageHeader
        eyebrow="Our Story"
        title="Crafting Spaces, Defining Luxury"
        description="For over 16 years, JB Decor has designed and delivered interiors that balance elegance, function, and craftsmanship."
        image={images.aboutStudio}
        crumbs={[{ label: 'About Us' }]}
      />

      {/* Story */}
      <Section tone="ivory">
        <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="relative">
            <div className="absolute -inset-3 border border-gold/25" aria-hidden />
            <SmartImage src={images.aboutStudio} alt="Inside the JB Decor design studio" className="relative aspect-[4/3] w-full" />
          </div>
          <div>
            <span className="eyebrow"><span className="rule-gold" />Who We Are</span>
            <h2 className="mt-4 font-serif text-3xl font-semibold text-forest md:text-4xl">
              {content.text('intro', 'title', 'A studio built on detail')}
            </h2>
            <p className="mt-5 leading-relaxed text-forest/75">
              {content.text('intro', 'body',
                'JB Decor began with a simple belief — that a well-designed space quietly improves everyday ' +
                'life. What started as a small design practice has grown into a full-service studio spanning ' +
                'interior design, bespoke furniture, premium décor, and complete turnkey execution.')}
            </p>
            <p className="mt-4 leading-relaxed text-forest/75">
              Today, our designers, architects, and craftspeople work as one team, taking projects from the
              first sketch to the final styled room — with the same care whether it's a single space or an
              entire home.
            </p>
          </div>
        </div>
      </Section>

      {/* Stats */}
      <Section tone="forest">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {heroStats.map((stat) => (
            <div key={stat.id} className="text-center">
              <div className="font-serif text-4xl font-semibold text-gold md:text-5xl">{stat.value}</div>
              <div className="mt-2 text-xs uppercase tracking-wide text-ivory/70">{stat.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Mission / Vision */}
      <Section tone="ivory">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { icon: Target, title: 'Our Mission', text: 'To craft interiors that feel personal, timeless, and effortless to live in — delivered with honesty and precision.' },
            { icon: Eye, title: 'Our Vision', text: 'To be the most trusted name in premium interiors, known for design integrity and flawless execution.' },
          ].map((b) => (
            <div key={b.title} className="border border-forest/10 bg-white p-6 shadow-card sm:p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold">
                <b.icon className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <h3 className="mt-5 font-serif text-2xl font-semibold text-forest">{b.title}</h3>
              <p className="mt-3 leading-relaxed text-forest/70">{b.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Philosophy */}
      <Section tone="white">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <div>
            <span className="eyebrow"><span className="rule-gold" />How We Design</span>
            <h2 className="mt-4 font-serif text-3xl font-semibold text-forest md:text-4xl">Our design philosophy</h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {philosophy.map((p) => (
              <li key={p} className="flex items-start gap-3 border border-forest/10 bg-ivory p-5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-dark">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm text-forest/75">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Why choose */}
      <Section tone="forestDeep">
        <SectionHeading eyebrow="The JB Decor Promise" title="Why Choose Us" align="center" onDark />
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3">
          {whyChooseFeatures.map((f) => (
            <div key={f.id} className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold">
                <Icon name={f.icon} className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold text-gold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ivory/70">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Testimonials */}
      <Section tone="ivory">
        <SectionHeading eyebrow="Client Stories" title="What Our Clients Say" align="center" />
        <div className="grid gap-6 lg:grid-cols-3">
          {testimonials.map((t) => <TestimonialCard key={t.id} testimonial={t} />)}
        </div>
      </Section>

      <CTABand />
    </>
  )
}
