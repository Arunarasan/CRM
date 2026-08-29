import { useParams, Link } from 'react-router-dom'
import { MapPin, Calendar, Tag, Check, ArrowRight, Quote } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section, SectionHeading } from '@/components/ui/Section'
import { SmartImage } from '@/components/ui/SmartImage'
import { PortfolioCard } from '@/components/cards/PortfolioCard'
import { Button } from '@/components/ui/Button'
import Placeholder from '@/pages/Placeholder'
import { portfolioProjects } from '@/data/portfolio'
import { getPortfolioDetail } from '@/data/portfolioDetails'
import { useSeo, breadcrumbJsonLd } from '@/hooks/useSeo'

export default function PortfolioDetail() {
  const { slug = '' } = useParams()
  const project = portfolioProjects.find((p) => p.slug === slug)
  useSeo(
    project
      ? {
          title: project.title,
          description: `${project.title} — a ${project.category.toLowerCase()} interior design project by JB Decor in ${project.location}, completed ${project.year}.`,
          image: project.image,
          type: 'article',
          jsonLd: breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Portfolio', path: '/portfolio' },
            { name: project.title, path: `/portfolio/${slug}` },
          ]),
        }
      : { title: 'Project Not Found', noIndex: true },
  )
  if (!project) return <Placeholder title="Project Not Found" />
  const detail = getPortfolioDetail(slug)
  const related = portfolioProjects.filter((p) => p.slug !== slug).slice(0, 3)

  const facts = [
    { icon: Tag, label: 'Category', value: project.category },
    { icon: MapPin, label: 'Location', value: project.location },
    { icon: Calendar, label: 'Completed', value: String(project.year) },
  ]

  return (
    <>
      <PageHeader
        eyebrow={project.category}
        title={project.title}
        image={project.image}
        crumbs={[{ label: 'Portfolio', to: '/portfolio' }, { label: project.title }]}
      />

      {/* Lead image + facts */}
      <Section tone="ivory">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] lg:gap-10">
          <SmartImage src={project.image} alt={project.title} className="aspect-[16/10] w-full" />
          <div className="flex flex-col gap-6">
            <div>
              <span className="eyebrow"><span className="rule-gold" />The Brief</span>
              <p className="mt-4 leading-relaxed text-forest/75">{detail.concept}</p>
            </div>
            <dl className="grid gap-4 border-t border-forest/10 pt-6">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 text-gold">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-forest/50">{f.label}</dt>
                    <dd className="font-medium text-forest">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      {/* Gallery */}
      <Section tone="white">
        <SectionHeading eyebrow="The Space" title="Project Gallery" align="left" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {detail.gallery.map((src, i) => (
            <SmartImage key={i} src={src} alt={`${project.title} view ${i + 1}`} className="aspect-[4/3]" />
          ))}
        </div>
      </Section>

      {/* Highlights + materials + services */}
      <Section tone="ivory">
        <div className="grid gap-6 sm:gap-8 md:grid-cols-3 md:gap-10">
          <div>
            <h3 className="font-serif text-xl font-semibold text-forest">Project Highlights</h3>
            <ul className="mt-4 space-y-3">
              {detail.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-sm text-forest/75">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" /> {h}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-xl font-semibold text-forest">Materials</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.materials.map((m) => (
                <span key={m} className="border border-forest/15 bg-white px-3 py-1.5 text-xs text-forest/75">{m}</span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-serif text-xl font-semibold text-forest">Services Delivered</h3>
            <ul className="mt-4 space-y-2">
              {detail.services.map((s) => (
                <li key={s}>
                  <Link to="/services" className="text-sm text-forest/75 transition-colors hover:text-gold-dark">
                    → {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Testimonial */}
      {detail.testimonial && (
        <Section tone="forest">
          <div className="mx-auto max-w-3xl text-center">
            <Quote className="mx-auto h-10 w-10 text-gold" />
            <blockquote className="mt-6 font-serif text-2xl leading-relaxed text-ivory md:text-3xl">
              “{detail.testimonial.quote}”
            </blockquote>
            <div className="mt-6 text-sm text-ivory/70">
              <span className="font-semibold text-gold">{detail.testimonial.name}</span> · {detail.testimonial.role}
            </div>
          </div>
        </Section>
      )}

      {/* Related */}
      <Section tone="white">
        <SectionHeading
          eyebrow="Explore More"
          title="Related Projects"
          align="left"
          action={<Button to="/portfolio" variant="ghost">View All <ArrowRight className="h-4 w-4" /></Button>}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((p) => (
            <PortfolioCard key={p.id} project={p} className="aspect-[4/5]" />
          ))}
        </div>
      </Section>
    </>
  )
}
