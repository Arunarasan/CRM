import { useParams, Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { SmartImage } from '@/components/ui/SmartImage'
import { Button } from '@/components/ui/Button'
import { CTABand } from '@/components/shared/CTABand'
import Placeholder from '@/pages/Placeholder'
import { getMaterial, materials } from '@/data/materials'
import { useSeo, breadcrumbJsonLd } from '@/hooks/useSeo'

export default function MaterialDetail() {
  const { slug = '' } = useParams()
  const material = getMaterial(slug)
  useSeo(
    material
      ? {
          title: material.name,
          description: `${material.name} — ${material.finish} finish in ${material.color}. A premium ${material.category.toLowerCase()} material curated by JB Decor.`,
          image: material.image,
          type: 'article',
          jsonLd: breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Materials', path: '/materials' },
            { name: material.name, path: `/materials/${slug}` },
          ]),
        }
      : { title: 'Material Not Found', noIndex: true },
  )
  if (!material) return <Placeholder title="Material Not Found" />
  const related = materials.filter((m) => m.category === material.category && m.slug !== slug).slice(0, 3)

  const specs = [
    { label: 'Category', value: material.category },
    { label: 'Finish', value: material.finish },
    { label: 'Colour', value: material.color },
  ]

  return (
    <>
      <PageHeader
        eyebrow={material.category}
        title={material.name}
        image={material.image}
        crumbs={[{ label: 'Materials', to: '/materials' }, { label: material.name }]}
      />

      <Section tone="ivory">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <SmartImage src={material.image} alt={material.name} className="aspect-[4/3] w-full" />
          <div>
            <span className="eyebrow"><span className="rule-gold" />About This Material</span>
            <p className="mt-4 text-lg leading-relaxed text-forest/75">{material.description}</p>

            <dl className="mt-8 grid grid-cols-3 gap-4">
              {specs.map((s) => (
                <div key={s.label} className="border border-forest/10 bg-white p-4">
                  <dt className="text-[11px] uppercase tracking-wide text-forest/50">{s.label}</dt>
                  <dd className="mt-1 font-medium text-forest">{s.value}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-8 text-xs font-semibold uppercase tracking-wide text-forest/60">Applications</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {material.applications.map((a) => (
                <span key={a} className="border border-forest/15 bg-white px-3 py-1.5 text-xs text-forest/75">{a}</span>
              ))}
            </div>

            <div className="mt-8">
              <Button to="/consultation" variant="primary">
                Enquire About This Material <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {related.length > 0 && (
        <Section tone="white">
          <h2 className="mb-8 font-serif text-2xl font-semibold text-forest">More {material.category}</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {related.map((m) => (
              <Link key={m.id} to={`/materials/${m.slug}`} className="group overflow-hidden border border-forest/10 bg-white shadow-card">
                <SmartImage src={m.image} alt={m.name} className="aspect-[4/3]" imgClassName="group-hover:scale-105" />
                <div className="p-4">
                  <h3 className="font-serif text-base font-semibold text-forest group-hover:text-gold-dark">{m.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <CTABand />
    </>
  )
}
