import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Section, SectionHeading } from '@/components/ui/Section'
import { portfolioProjects as portfolioSeed } from '@/data/portfolio'
import { PortfolioCard } from '@/components/cards/PortfolioCard'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'

export function FeaturedPortfolio() {
  const portfolioProjects = usePublicData(portfolioSeed, publicApi.portfolio)
  const [first, ...rest] = portfolioProjects.slice(0, 5)
  return (
    <Section tone="white">
      <SectionHeading
        eyebrow="Selected Work"
        title="Featured Portfolio"
        align="left"
        action={
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-dark transition-colors hover:text-forest"
          >
            View All Projects <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {/* Editorial layout: one tall feature + a 2x2 grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        <PortfolioCard project={first} className="aspect-[4/5] lg:aspect-auto lg:h-full" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {rest.map((project) => (
            <PortfolioCard key={project.id} project={project} className="aspect-[4/3]" />
          ))}
        </div>
      </div>
    </Section>
  )
}
