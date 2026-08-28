import { useState } from 'react'
import { Star, Wrench } from 'lucide-react'
import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection } from '@/components/portal/PortalUI'
import { toast } from '@/store/toast'

interface PortalService {
  id: number
  title: string
  slug: string
  shortDescription?: string
  imageUrl?: string
  avgRating: number
  reviewCount: number
  myRating: number | null
  myComment: string | null
}

function StarRow({ value, onChange, readOnly }: { value: number; onChange?: (n: number) => void; readOnly?: boolean }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i} type="button" disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(i)} onMouseLeave={() => !readOnly && setHover(0)}
          onClick={() => onChange?.(i)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
        >
          <Star className={`h-5 w-5 ${i <= (hover || value) ? 'fill-gold text-gold' : 'text-forest/20'}`} />
        </button>
      ))}
    </div>
  )
}

function ServiceCard({ service, onSaved }: { service: PortalService; onSaved: () => void }) {
  const [rating, setRating] = useState(service.myRating ?? 0)
  const [comment, setComment] = useState(service.myComment ?? '')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (rating < 1) { toast('Please pick a star rating.', 'error'); return }
    setBusy(true)
    try {
      await portalApi.reviewService(service.id, rating, comment)
      toast('Thanks for your review!', 'success')
      setOpen(false)
      onSaved()
    } catch {
      toast('Could not submit your review. Please try again.', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="border border-forest/10 bg-white">
      <div className="flex gap-4 p-4">
        {service.imageUrl
          ? <img src={service.imageUrl} alt="" className="h-16 w-16 shrink-0 object-cover" />
          : <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-forest/5 text-gold"><Wrench className="h-6 w-6" /></div>}
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-semibold text-forest">{service.title}</h3>
          {service.shortDescription && <p className="mt-0.5 line-clamp-2 text-sm text-forest/60">{service.shortDescription}</p>}
          <div className="mt-2 flex items-center gap-2 text-sm text-forest/60">
            <StarRow value={Math.round(service.avgRating)} readOnly />
            <span>{service.avgRating > 0 ? service.avgRating.toFixed(1) : 'No ratings'} {service.reviewCount > 0 && `· ${service.reviewCount} review${service.reviewCount > 1 ? 's' : ''}`}</span>
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="h-max shrink-0 text-sm font-semibold text-gold-dark hover:text-gold">
          {service.myRating ? 'Edit review' : 'Write a review'}
        </button>
      </div>

      {open && (
        <div className="border-t border-forest/10 bg-ivory/40 p-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-forest/60">Your rating</label>
          <div className="mt-1"><StarRow value={rating} onChange={setRating} /></div>
          <textarea
            value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
            placeholder="Tell others about your experience with this service…"
            className="mt-3 w-full border border-forest/15 bg-white px-3 py-2 text-sm text-forest focus:border-gold focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button onClick={submit} disabled={busy}
              className="bg-gold px-4 py-2 text-sm font-semibold uppercase tracking-wide text-forest hover:bg-gold-dark disabled:opacity-60">
              {busy ? 'Submitting…' : 'Submit review'}
            </button>
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-forest/60 hover:text-forest">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PortalServices() {
  const { data, loading, error, reload } = useFetch<PortalService[]>(() => portalApi.services())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">Services</h1>
        <p className="mt-1 text-forest/55">Our services — and your reviews of them.</p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}
        empty={!!data && data.length === 0}
        emptyMessage="No services are available right now.">
        <div className="space-y-3">
          {data?.map((s) => <ServiceCard key={s.id} service={s} onSaved={reload} />)}
        </div>
      </AsyncSection>
    </div>
  )
}
