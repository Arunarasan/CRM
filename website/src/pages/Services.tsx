import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { ServiceCard } from '@/components/cards/ServiceCard'
import { CTABand } from '@/components/shared/CTABand'
import { services as servicesSeed } from '@/data/services'
import { images } from '@/config/images'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'
import { useSeo, itemListJsonLd } from '@/hooks/useSeo'

export default function Services() {
  const services = usePublicData(servicesSeed, publicApi.services)
  useSeo({
    title: 'Measurement, Stitching & Installation',
    description: 'On-site measurement, in-house curtain stitching and professional installation of curtains, blinds, mosquito nets and wall décor — plus false ceilings, modular kitchens and PVC cupboards by JB Decor.',
    jsonLd: itemListJsonLd('JB Decor Services',
      services.map((s) => ({ name: s.title, path: `/services/${s.slug}` }))),
  })
  return (
    <>
      <PageHeader
        eyebrow="What We Do"
        title="Our Services"
        description="From a single room to a complete turnkey interior, JB Decor delivers design and craftsmanship under one signature."
        image={images.services.interiorDesign}
        crumbs={[{ label: 'Services' }]}
      />
      <Section tone="ivory">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </Section>
      <CTABand />
    </>
  )
}
