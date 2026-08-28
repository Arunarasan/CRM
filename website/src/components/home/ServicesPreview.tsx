import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Section, SectionHeading } from '@/components/ui/Section'
import { services as servicesSeed } from '@/data/services'
import { ServiceCard } from '@/components/cards/ServiceCard'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'

export function ServicesPreview() {
  const services = usePublicData(servicesSeed, publicApi.services)
  return (
    <Section tone="ivory">
      <SectionHeading
        eyebrow="What We Do"
        title="Our Services"
        align="left"
        action={
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-dark transition-colors hover:text-forest"
          >
            All Services <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </Section>
  )
}
