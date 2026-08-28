import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { PortfolioCard } from '@/components/cards/PortfolioCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { CTABand } from '@/components/shared/CTABand'
import { portfolioProjects as portfolioSeed } from '@/data/portfolio'
import { images } from '@/config/images'
import { cn } from '@/lib/utils'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'
import { useSeo } from '@/hooks/useSeo'

export default function Portfolio() {
  useSeo({ title: 'Our Portfolio', description: "A curated look at interiors JB Decor has designed and delivered — residential, commercial, villas, and more." })
  const portfolioProjects = usePublicData(portfolioSeed, publicApi.portfolio)
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(portfolioProjects.map((p) => p.category)))],
    [portfolioProjects],
  )
  const [active, setActive] = useState('All')
  const filtered = active === 'All' ? portfolioProjects : portfolioProjects.filter((p) => p.category === active)

  return (
    <>
      <PageHeader
        eyebrow="Selected Work"
        title="Our Portfolio"
        description="A curated look at spaces we've designed and delivered — residential, commercial, and everything in between."
        image={images.portfolio.villa}
        crumbs={[{ label: 'Portfolio' }]}
      />

      <Section tone="ivory">
        {/* Category filter */}
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1 sm:mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={cn(
                'whitespace-nowrap border px-5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                active === cat
                  ? 'border-gold bg-gold text-forest'
                  : 'border-forest/15 text-forest/70 hover:border-forest',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No projects in this category" message="Try another category to explore our work." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <PortfolioCard key={project.id} project={project} className="aspect-[4/5]" />
            ))}
          </div>
        )}
      </Section>

      <CTABand />
    </>
  )
}
