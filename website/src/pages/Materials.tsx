import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowUpRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { SmartImage } from '@/components/ui/SmartImage'
import { EmptyState } from '@/components/shared/EmptyState'
import { CTABand } from '@/components/shared/CTABand'
import { materials as materialsSeed, materialCategories } from '@/data/materials'
import { images } from '@/config/images'
import { cn } from '@/lib/utils'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'

export default function Materials() {
  const [active, setActive] = useState('All')
  const [search, setSearch] = useState('')
  const materials = usePublicData(materialsSeed, publicApi.materials)

  const filtered = useMemo(
    () =>
      materials.filter((m) => {
        if (active !== 'All' && m.category !== active) return false
        if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      }),
    [materials, active, search],
  )

  return (
    <>
      <PageHeader
        eyebrow="The Foundation of Luxury"
        title="Materials & Finishes"
        description="The woods, stones, and finishes we trust — sourced for beauty, durability, and a premium feel underfoot and to the touch."
        image={images.portfolio.kitchen}
        crumbs={[{ label: 'Materials' }]}
      />

      <Section tone="ivory">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {['All', ...materialCategories].map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={cn(
                  'whitespace-nowrap border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                  active === cat ? 'border-gold bg-gold text-forest' : 'border-forest/15 text-forest/70 hover:border-forest',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials…"
              aria-label="Search materials"
              className="w-full border border-forest/15 bg-white py-2.5 pl-10 pr-4 text-sm text-forest placeholder:text-forest/35 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No materials found" message="Try another category or search term." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <Link
                key={m.id}
                to={`/materials/${m.slug}`}
                className="group flex flex-col overflow-hidden border border-forest/10 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <SmartImage src={m.image} alt={m.name} className="h-full w-full" imgClassName="group-hover:scale-105" />
                  <span className="absolute left-3 top-3 bg-forest/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold">
                    {m.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-lg font-semibold text-forest transition-colors group-hover:text-gold-dark">{m.name}</h3>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-forest/30 transition-colors group-hover:text-gold" />
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-forest/60">{m.description}</p>
                  <div className="mt-4 flex gap-4 border-t border-forest/10 pt-3 text-xs text-forest/55">
                    <span><span className="text-forest/40">Finish:</span> {m.finish}</span>
                    <span><span className="text-forest/40">Colour:</span> {m.color}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <CTABand title="Not sure which materials suit your space?" subtitle="Our designers will guide you to the right woods, stones, and finishes for your project." />
    </>
  )
}
