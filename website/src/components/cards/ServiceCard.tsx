import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Service } from '@/types'
import { SmartImage } from '@/components/ui/SmartImage'
import { Icon } from '@/lib/icons'

export function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      to={`/services/${service.slug}`}
      className="group relative flex flex-col overflow-hidden border border-forest/10 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <SmartImage
          src={service.image}
          alt={service.title}
          className="h-full w-full"
          imgClassName="group-hover:scale-105"
        />
        <span className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center bg-forest/90 text-gold backdrop-blur-sm">
          <Icon name={service.icon} className="h-5 w-5" strokeWidth={1.5} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
        <h3 className="font-serif text-xl font-semibold text-forest transition-colors group-hover:text-gold-dark">
          {service.title}
        </h3>
        <p className="text-sm leading-relaxed text-forest/65">{service.shortDescription}</p>
        <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-dark">
          Learn More
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}
