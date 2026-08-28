import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PortfolioProject } from '@/types'
import { SmartImage } from '@/components/ui/SmartImage'

export function PortfolioCard({
  project,
  className,
}: {
  project: PortfolioProject
  className?: string
}) {
  return (
    <Link
      to={`/portfolio/${project.slug}`}
      className={cn('group relative block overflow-hidden', className)}
    >
      <SmartImage
        src={project.image}
        alt={`${project.title} — ${project.category} interior in ${project.location}`}
        className="h-full w-full"
        imgClassName="h-full transition-transform duration-700 group-hover:scale-110"
      />
      {/* Forest overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-deep/90 via-forest/30 to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-95" />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
        <div className="translate-y-2 transition-transform duration-500 group-hover:translate-y-0">
          <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-gold">
            {project.category}
          </span>
          <h3 className="mt-1 font-serif text-xl font-semibold text-ivory">{project.title}</h3>
          <p className="text-sm text-ivory/70">
            {project.location} · {project.year}
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-gold/60 text-gold opacity-0 transition-all duration-500 group-hover:opacity-100">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>
    </Link>
  )
}
