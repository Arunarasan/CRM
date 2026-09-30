import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Star, Sparkles, AlertCircle, Phone, CheckCircle2 } from 'lucide-react'
import { publicApi, type EmployeeReviewInfo } from '@/api/publicApi'
import { useSite } from '@/hooks/useSiteSettings'
import { useSeo } from '@/hooks/useSeo'

/**
 * Public, no-login employee review page. Reached only by scanning an employee's personal review QR
 * (/r/:token — the token is the credential). The customer rates + writes a message (captured against
 * that employee in the CRM), then is redirected to the company's Google review page to post publicly.
 */
export default function ReviewEmployee() {
  const { token = '' } = useParams()
  const site = useSite()
  const [info, setInfo] = useState<EmployeeReviewInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useSeo({ title: 'Leave a Review', description: 'Share your feedback.', noIndex: true })

  const load = useCallback(() => {
    setLoading(true)
    publicApi.employeeReviewInfo(token)
      .then((d) => { setInfo(d); setError(null) })
      .catch((e) => setError(e?.response?.data?.message || 'This review link is invalid or no longer active.'))
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

  if (error || !info) {
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
      <div className="mx-auto max-w-md pb-16">
        <ReviewForm token={token} info={info} />
      </div>
    </Shell>
  )
}

/* ---------- Layout shell (minimal chrome, no site nav) ---------- */
function Shell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-forest/10 bg-forest">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-4">
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-serif text-lg font-semibold text-ivory">{name}</span>
          <span className="ml-auto text-xs uppercase tracking-widest text-gold">Feedback</span>
        </div>
      </header>
      <main className="px-4 pt-6">{children}</main>
    </div>
  )
}

function ReviewForm({ token, info }: { token: string; info: EmployeeReviewInfo }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) return
    setBusy(true)
    try {
      const res = await publicApi.submitEmployeeReview(token, {
        rating, reviewerName: name, reviewerPhone: phone, comment,
      })
      const url = res?.googleReviewUrl
      if (url) {
        // Send the customer on to post the review publicly on Google.
        window.location.href = url
        return
      }
      setDone(true)
    } catch {
      setDone(true) // still thank them; the feedback was captured or the link is being retried
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 font-serif text-xl font-semibold text-forest">Thank you!</h1>
        <p className="mt-2 text-sm text-forest/60">Your feedback means a lot to us.</p>
      </div>
    )
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      {/* Who they're reviewing */}
      <div className="mb-5 flex flex-col items-center text-center">
        {info.photoUrl
          ? <img src={info.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-ivory shadow" />
          : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-forest/10 text-2xl font-bold text-forest">
              {info.employeeName?.[0] || '★'}
            </div>}
        <h1 className="mt-3 font-serif text-xl font-semibold text-forest">How was your experience?</h1>
        <p className="mt-1 text-sm text-forest/60">
          You're rating <b className="text-forest">{info.employeeName}</b>
          {info.designation ? ` · ${info.designation}` : ''}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)} className="p-0.5">
              <Star className={`h-9 w-9 transition ${(hover || rating) >= n ? 'fill-gold text-gold' : 'text-forest/20'}`} />
            </button>
          ))}
        </div>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
          className="w-full rounded-lg border border-forest/15 px-3 py-2.5 text-sm outline-none focus:border-gold" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)"
          className="w-full rounded-lg border border-forest/15 px-3 py-2.5 text-sm outline-none focus:border-gold" />
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
          placeholder="Tell us about your experience (optional)"
          className="w-full rounded-lg border border-forest/15 px-3 py-2.5 text-sm outline-none focus:border-gold" />

        <button disabled={busy || rating < 1}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-forest disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />} Submit review
        </button>

        {info.googleReviewUrl && (
          <p className="text-center text-xs text-forest/45">
            You'll be taken to Google to complete your review.
          </p>
        )}
      </form>
    </section>
  )
}
