import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Check, Circle, Loader2, MapPin, Calendar, Clock, Star, Send,
  MessageSquarePlus, Sparkles, Phone, AlertCircle,
} from 'lucide-react'
import { publicApi, type TrackingData } from '@/api/publicApi'
import { useSite } from '@/hooks/useSiteSettings'
import { useSeo } from '@/hooks/useSeo'

/**
 * Public, no-login project tracking page (Amazon/Flipkart order-tracking style). Reached only via
 * the unguessable share link /track/:token — the token is the credential. Shows the project's
 * timeline, progress and current activity, and lets the customer submit a request or leave a review.
 */
export default function TrackProject() {
  const { token = '' } = useParams()
  const site = useSite()
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Private, per-client link — keep it out of search indexes entirely.
  useSeo({ title: 'Project Tracker', description: 'Track your project with JB Decor.', noIndex: true })

  const load = useCallback(() => {
    setLoading(true)
    publicApi.track(token)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e?.response?.data?.message || 'This tracking link is invalid or no longer active.'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Shell name={site.name}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      </Shell>
    )
  }

  if (error || !data) {
    return (
      <Shell name={site.name}>
        <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-gold" />
          <h1 className="mt-4 font-serif text-xl font-semibold text-forest">Link not available</h1>
          <p className="mt-2 text-sm text-forest/60">{error}</p>
          {site.phone && (
            <a href={`tel:${site.phone}`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-ivory">
              <Phone className="h-4 w-4" /> Call us
            </a>
          )}
        </div>
      </Shell>
    )
  }

  return (
    <Shell name={site.name}>
      <div className="mx-auto max-w-3xl space-y-5 pb-16">
        <HeaderCard data={data} />
        {data.currentActivity && <CurrentActivity text={data.currentActivity} />}
        <Timeline data={data} />
        {data.updates.length > 0 && <Updates data={data} />}
        <RequestForm token={token} />
        <ReviewSection token={token} data={data} onPosted={load} />
      </div>
    </Shell>
  )
}

/* ---------- Layout shell (minimal chrome, no site nav) ---------- */
function Shell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-forest/10 bg-forest">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-serif text-lg font-semibold text-ivory">{name}</span>
          <span className="ml-auto text-xs uppercase tracking-widest text-gold">Project Tracker</span>
        </div>
      </header>
      <main className="px-4 pt-5">{children}</main>
    </div>
  )
}

function statusColor(status: string) {
  const s = status?.toUpperCase()
  if (['COMPLETED', 'CLOSED'].includes(s)) return 'bg-emerald-100 text-emerald-700'
  if (['RUNNING'].includes(s)) return 'bg-blue-100 text-blue-700'
  if (['PAUSED', 'ON_HOLD'].includes(s)) return 'bg-amber-100 text-amber-700'
  if (['CANCELLED'].includes(s)) return 'bg-rose-100 text-rose-700'
  return 'bg-forest/10 text-forest'
}

/* ---------- Header: project + progress ring ---------- */
function HeaderCard({ data }: { data: TrackingData }) {
  const pct = Math.max(0, Math.min(100, data.progress ?? 0))
  const r = 34
  const circ = 2 * Math.PI * r
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
            <circle cx="40" cy="40" r={r} fill="none" stroke="#0B2B231a" strokeWidth="8" />
            <circle cx="40" cy="40" r={r} fill="none" stroke="#D6A84F" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circ}
              strokeDashoffset={circ - (pct / 100) * circ} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-forest">{pct}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-xl font-semibold text-forest sm:text-2xl">{data.projectName}</h1>
          <p className="mt-0.5 text-xs text-forest/45">
            {data.projectCode}{data.projectType ? ` · ${data.projectType}` : ''}
          </p>
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor(data.status)}`}>
            {data.status?.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-forest/10 pt-4 text-sm">
        {data.propertyAddress && (
          <Fact icon={<MapPin className="h-4 w-4" />} label="Location" value={data.propertyAddress} />
        )}
        {data.startDate && (
          <Fact icon={<Calendar className="h-4 w-4" />} label="Started" value={data.startDate} />
        )}
        {data.expectedCompletionDate && !data.actualCompletionDate && (
          <Fact icon={<Clock className="h-4 w-4" />} label="Expected completion" value={data.expectedCompletionDate} />
        )}
        {data.actualCompletionDate && (
          <Fact icon={<Check className="h-4 w-4" />} label="Completed on" value={data.actualCompletionDate} />
        )}
      </dl>
      {data.customerNotes && (
        <p className="mt-4 rounded-lg bg-ivory px-4 py-3 text-sm text-forest/70">{data.customerNotes}</p>
      )}
    </section>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-gold">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-forest/45">{label}</dt>
        <dd className="truncate text-forest" title={value}>{value}</dd>
      </div>
    </div>
  )
}

function CurrentActivity({ text }: { text: string }) {
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 px-5 py-4">
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-gold" />
      </span>
      <div>
        <p className="text-xs uppercase tracking-wide text-gold-dark">Happening now</p>
        <p className="text-sm font-medium text-forest">{text}</p>
      </div>
    </section>
  )
}

/* ---------- Timeline stepper ---------- */
function Timeline({ data }: { data: TrackingData }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-5 font-serif text-lg font-semibold text-forest">Project Journey</h2>
      <ol className="relative">
        {data.timeline.map((step, i) => {
          const done = step.status === 'DONE'
          const current = step.status === 'CURRENT'
          const last = i === data.timeline.length - 1
          return (
            <li key={`${step.name}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
              {!last && (
                <span className={`absolute left-[15px] top-8 h-full w-0.5 ${done ? 'bg-gold' : 'bg-forest/15'}`} />
              )}
              <span className={[
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                done ? 'bg-gold text-forest'
                  : current ? 'border-2 border-gold bg-white text-gold'
                    : 'border border-forest/20 bg-white text-forest/30',
              ].join(' ')}>
                {done ? <Check className="h-4 w-4" />
                  : current ? <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                    : <Circle className="h-3 w-3" />}
              </span>
              <div className="min-w-0 pt-1">
                <p className={[
                  'text-sm',
                  done ? 'font-medium text-forest'
                    : current ? 'font-semibold text-gold-dark'
                      : 'text-forest/40',
                ].join(' ')}>{step.name}</p>
                {current && typeof step.percent === 'number' && step.percent > 0 && (
                  <p className="mt-0.5 text-xs text-forest/45">{step.percent}% complete</p>
                )}
                {(step.startDate || step.endDate) && (
                  <p className="mt-0.5 text-xs text-forest/35">
                    {step.startDate}{step.endDate ? ` → ${step.endDate}` : ''}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Updates({ data }: { data: TrackingData }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-serif text-lg font-semibold text-forest">Recent Updates</h2>
      <ul className="space-y-3">
        {data.updates.map((u, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <div>
              <p className="text-forest/80">{u.description}</p>
              {u.time && <p className="text-xs text-forest/35">{new Date(u.time).toLocaleString()}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------- Submit a request ---------- */
function RequestForm({ token }: { token: string }) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setBusy(true)
    try {
      await publicApi.trackSubmitRequest(token, {
        name, contact, subject: 'Request from tracking page', description: message,
      })
      setDone(true); setMessage('')
    } catch { /* surfaced below */ } finally { setBusy(false) }
  }

  if (done) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <Check className="mx-auto h-8 w-8 text-emerald-600" />
        <p className="mt-2 font-medium text-emerald-800">Your request has reached our team.</p>
        <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline">
          Send another
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-forest">
        <MessageSquarePlus className="h-5 w-5 text-gold" /> Have a request?
      </h2>
      <p className="mb-4 text-sm text-forest/50">Ask a question or request a change — we'll get back to you.</p>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
            className="rounded-lg border border-forest/15 px-3 py-2.5 text-sm outline-none focus:border-gold" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email"
            className="rounded-lg border border-forest/15 px-3 py-2.5 text-sm outline-none focus:border-gold" />
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} required
          placeholder="What would you like us to do?"
          className="w-full rounded-lg border border-forest/15 px-3 py-2.5 text-sm outline-none focus:border-gold" />
        <button disabled={busy || !message.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-ivory disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit request
        </button>
      </form>
    </section>
  )
}

/* ---------- Reviews ---------- */
function ReviewSection({ token, data, onPosted }: { token: string; data: TrackingData; onPosted: () => void }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) return
    setBusy(true)
    try {
      await publicApi.trackSubmitReview(token, { rating, name, comment })
      setDone(true); onPosted()
    } catch { /* ignore */ } finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-serif text-lg font-semibold text-forest">Rate your experience</h2>

      {done ? (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
          Thank you for your feedback!
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)} className="p-0.5">
                <Star className={`h-7 w-7 ${(hover || rating) >= n ? 'fill-gold text-gold' : 'text-forest/20'}`} />
              </button>
            ))}
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
            className="w-full rounded-lg border border-forest/15 px-3 py-2.5 text-sm outline-none focus:border-gold" />
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
            placeholder="Tell us about your experience (optional)"
            className="w-full rounded-lg border border-forest/15 px-3 py-2.5 text-sm outline-none focus:border-gold" />
          <button disabled={busy || rating < 1}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-forest disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />} Post review
          </button>
        </form>
      )}

      {data.reviews.length > 0 && (
        <ul className="mt-6 space-y-4 border-t border-forest/10 pt-5">
          {data.reviews.map((r, i) => (
            <li key={i}>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-4 w-4 ${r.rating >= n ? 'fill-gold text-gold' : 'text-forest/15'}`} />
                  ))}
                </div>
                <span className="text-sm font-medium text-forest">{r.reviewerName || 'Customer'}</span>
              </div>
              {r.comment && <p className="mt-1 text-sm text-forest/65">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
