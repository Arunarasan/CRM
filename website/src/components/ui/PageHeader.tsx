import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { SmartImage } from './SmartImage'

export interface Crumb {
  label: string
  to?: string
}

/**
 * Editorial page header band used across internal pages: eyebrow + title + breadcrumb
 * over an optional forest-tinted image. Keeps every page opening on-brand and consistent.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  image,
  crumbs = [],
}: {
  eyebrow?: string
  title: string
  description?: string
  image?: string
  crumbs?: Crumb[]
}) {
  return (
    <section className="relative overflow-hidden bg-forest">
      {image && (
        <div className="absolute inset-0">
          <SmartImage src={image} alt="" className="h-full w-full" imgClassName="h-full" />
          <div className="absolute inset-0 bg-gradient-to-r from-forest-deep via-forest/90 to-forest/70" />
        </div>
      )}
      <div className="container relative py-12 sm:py-16 md:py-24">
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ivory/60 sm:mb-5">
          <Link to="/" className="transition-colors hover:text-gold">Home</Link>
          {crumbs.map((c) => (
            <span key={c.label} className="flex items-center gap-2">
              <ChevronRight className="h-3.5 w-3.5" />
              {c.to ? (
                <Link to={c.to} className="transition-colors hover:text-gold">{c.label}</Link>
              ) : (
                <span className="text-gold">{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        {eyebrow && (
          <span className="eyebrow">
            <span className="rule-gold" />
            {eyebrow}
          </span>
        )}
        <h1 className="mt-4 max-w-3xl font-serif text-[2rem] font-semibold leading-tight text-ivory sm:text-4xl md:text-5xl lg:text-6xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ivory/70 sm:mt-5 sm:text-base md:text-lg">
            {description}
          </p>
        )}
      </div>
    </section>
  )
}
