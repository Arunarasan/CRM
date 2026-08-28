import { useState } from 'react'
import { ArrowRight, RotateCcw, Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SmartImage } from '@/components/ui/SmartImage'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { designGroups, roomPreviewImage } from '@/data/designStudio'
import { images } from '@/config/images'

const ResetIcon = RotateCcw

type Selections = Record<string, string | string[]>

const defaults: Selections = {
  room: 'Living Room',
  style: 'Modern Luxury',
  palette: 'Forest & Gold',
  materials: ['Marble', 'Wood'],
  decor: ['Plants'],
}

export default function DesignStudio() {
  const [sel, setSel] = useState<Selections>(defaults)

  const pick = (group: string, value: string, multi?: boolean) => {
    setSel((prev) => {
      if (multi) {
        const current = Array.isArray(prev[group]) ? (prev[group] as string[]) : []
        return {
          ...prev,
          [group]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
        }
      }
      return { ...prev, [group]: value }
    })
  }

  const isActive = (group: string, value: string, multi?: boolean) =>
    multi ? (Array.isArray(sel[group]) && (sel[group] as string[]).includes(value)) : sel[group] === value

  const room = (sel.room as string) || 'Living Room'
  const previewImage = roomPreviewImage[room] ?? images.designStudio
  const paletteSwatch = designGroups
    .find((g) => g.key === 'palette')
    ?.options.find((o) => o.value === sel.palette)?.swatch

  const summary = designGroups
    .map((g) => {
      const v = sel[g.key]
      const text = Array.isArray(v) ? v.join(', ') : v
      return text ? { label: g.label, value: text } : null
    })
    .filter(Boolean) as { label: string; value: string }[]

  return (
    <>
      <PageHeader
        eyebrow="Visualize. Customize. Perfect."
        title="Design Studio"
        description="Build your concept — choose a room, a style, a palette, and the pieces you love. See it take shape before a single wall is touched."
        image={images.designStudio}
        crumbs={[{ label: 'Design Studio' }]}
      />

      <section className="bg-ivory py-10 sm:py-12 md:py-16">
        <div className="container grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
          {/* Configurator */}
          <div className="order-2 space-y-6 sm:space-y-8 lg:order-1">
            {designGroups.map((group) => (
              <div key={group.key}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-forest/60">
                    {group.label}
                    {group.multi && <span className="ml-2 text-forest/35">(select any)</span>}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {group.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => pick(group.key, opt.value, group.multi)}
                      className={cn(
                        'flex items-center gap-2 border px-4 py-2.5 text-sm transition-all',
                        isActive(group.key, opt.value, group.multi)
                          ? 'border-gold bg-gold/10 font-medium text-forest'
                          : 'border-forest/15 text-forest/70 hover:border-forest/40',
                      )}
                    >
                      {opt.swatch && (
                        <span className="flex overflow-hidden rounded-full border border-forest/10">
                          {opt.swatch.map((c) => (
                            <span key={c} className="h-4 w-4" style={{ backgroundColor: c }} />
                          ))}
                        </span>
                      )}
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={() => setSel(defaults)}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forest/50 transition-colors hover:text-gold-dark"
            >
              <ResetIcon className="h-4 w-4" /> Reset selections
            </button>
          </div>

          {/* Live preview — leads on mobile, sticky beside the options on desktop */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-24 lg:h-max">
            <div className="overflow-hidden border border-forest/10 bg-white shadow-card">
              <div className="relative">
                <SmartImage src={previewImage} alt={`${sel.style} ${room} concept`} className="aspect-[16/10] w-full sm:aspect-[4/3]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest-deep/90 to-transparent p-5">
                  <div className="flex items-center gap-2 text-gold">
                    <Wand2 className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide">Your Concept</span>
                  </div>
                  <h3 className="mt-1 font-serif text-xl font-semibold text-ivory">
                    {sel.style} {room}
                  </h3>
                  {paletteSwatch && (
                    <div className="mt-2 flex gap-1.5">
                      {paletteSwatch.map((c) => (
                        <span key={c} className="h-5 w-5 rounded-full border border-ivory/30" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5">
                <dl className="space-y-2.5 text-sm">
                  {summary.map((s) => (
                    <div key={s.label} className="flex justify-between gap-4 border-b border-forest/5 pb-2.5 last:border-0">
                      <dt className="text-forest/50">{s.label}</dt>
                      <dd className="text-right font-medium text-forest">{s.value}</dd>
                    </div>
                  ))}
                </dl>
                <Button
                  to={`/consultation?concept=${encodeURIComponent(`${sel.style} ${room}`)}`}
                  variant="primary"
                  className="mt-5 w-full"
                >
                  Request This Concept <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="mt-3 text-center text-xs text-forest/45">
                  Our designers will refine this into a full proposal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
