import { useParams } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Accordion } from '@/components/ui/Accordion'
import { Button } from '@/components/ui/Button'
import { SmartImage } from '@/components/ui/SmartImage'
import { CTABand } from '@/components/shared/CTABand'
import Placeholder from '@/pages/Placeholder'
import { getService } from '@/data/services'
import { getServiceDetail } from '@/data/serviceDetails'
import { useSeo, breadcrumbJsonLd } from '@/hooks/useSeo'

export default function ServiceDetail() {
  const { slug = '' } = useParams()
  const service = getService(slug)
  useSeo(
    service
      ? {
          title: service.title,
          description: service.shortDescription,
          image: service.image,
          type: 'article',
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'Service',
              name: service.title,
              description: service.shortDescription,
              serviceType: service.title,
              areaServed: 'IN',
              provider: { '@type': 'Organization', name: 'JB Decor', url: 'https://jbdecorcdm.com/' },
            },
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Services', path: '/services' },
              { name: service.title, path: `/services/${slug}` },
            ]),
          ],
        }
      : { title: 'Service Not Found', noIndex: true },
  )
  if (!service) return <Placeholder title="Service Not Found" />
  const detail = getServiceDetail(slug)

  return (
    <>
      <PageHeader
        eyebrow="Service"
        title={service.title}
        description={service.shortDescription}
        image={service.image}
        crumbs={[{ label: 'Services', to: '/services' }, { label: service.title }]}
      />

      {/* Overview + benefits */}
      <Section tone="ivory">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
          <div>
            <span className="eyebrow"><span className="rule-gold" />Overview</span>
            <p className="mt-5 text-lg leading-relaxed text-forest/75">{detail.overview}</p>

            <h3 className="mt-10 font-serif text-2xl font-semibold text-forest">Key Benefits</h3>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {detail.benefits.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-dark">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm text-forest/75">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="h-max border border-forest/10 bg-white p-7 shadow-card">
            <h3 className="font-serif text-xl font-semibold text-forest">Signature Materials</h3>
            <ul className="mt-4 space-y-2.5">
              {detail.materials.map((m) => (
                <li key={m} className="flex items-center gap-3 text-sm text-forest/75">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" /> {m}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-forest/10 pt-6">
              <Button to="/consultation" variant="primary" className="w-full">
                Book a Consultation <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </aside>
        </div>
      </Section>

      {/* Process */}
      <Section tone="forest">
        <SectionHeading eyebrow="How We Work" title="Our Process" align="center" onDark />
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {detail.process.map((step, i) => (
            <li key={step.title} className="border border-ivory/10 bg-forest-light/50 p-6">
              <span className="font-serif text-3xl font-semibold text-gold">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 font-serif text-lg font-semibold text-ivory">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ivory/65">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Gallery */}
      <Section tone="white">
        <SectionHeading eyebrow="Selected Work" title="Gallery" align="left" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {detail.gallery.map((src, i) => (
            <SmartImage key={i} src={src} alt={`${service.title} example ${i + 1}`} className="aspect-square" />
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="ivory">
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="Good to Know" title="Frequently Asked Questions" align="center" />
          <Accordion items={detail.faq} />
        </div>
      </Section>

      <CTABand title={`Interested in ${service.title.toLowerCase()}?`} />
    </>
  )
}
