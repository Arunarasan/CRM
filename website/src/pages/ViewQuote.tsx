import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  AlertCircle, BadgeCheck, CalendarDays, Check, Download, FileText, ImageIcon, Loader2, MapPin,
  MessageCircle, Phone, Printer,
} from 'lucide-react'
import { publicApi, type SharedQuote, type SharedQuoteItem } from '@/api/publicApi'
import { useSite } from '@/hooks/useSiteSettings'
import { useSeo } from '@/hooks/useSeo'

/**
 * Public, no-login quotation page — reached only through the link sent with the PDF by the CRM's
 * "Share Quote" (/q/:token). The token is the credential and opens this one quotation: no site menu,
 * no links into the rest of the site or the CRM. The customer can read it, download the PDF and
 * accept it (the team then confirms the approval in the CRM).
 */
export default function ViewQuote() {
  const { token = '' } = useParams()
  const site = useSite()
  const [data, setData] = useState<SharedQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Private, per-customer link — keep it out of search indexes entirely.
  useSeo({ title: 'Your Quotation', description: `Quotation from ${site.name}.`, noIndex: true })

  useEffect(() => {
    setLoading(true)
    publicApi.quote(token)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e?.response?.data?.message || 'This quotation link is not valid or has been turned off.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <Shell site={site}>
        <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
      </Shell>
    )
  }
  if (error || !data) {
    return (
      <Shell site={site}>
        <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-gold" />
          <h1 className="mt-4 font-serif text-xl font-semibold text-forest">Link not available</h1>
          <p className="mt-2 text-sm text-forest/60">{error}</p>
          <ContactButtons site={site} className="mt-5 justify-center" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell site={site}>
      <div className="mx-auto max-w-4xl space-y-4 pb-24 print:space-y-3 print:pb-0">
        <StateBanner data={data} />
        <HeaderCard data={data} />
        <Items items={data.items} />
        <Summary data={data} />
        {data.terms.length > 0 && <Terms terms={data.terms} />}
        <AcceptCard token={token} data={data} onChange={setData} />
        <section className="rounded-2xl bg-white p-5 shadow-sm print:hidden">
          <p className="text-sm text-forest/70">Questions or changes? We're happy to help.</p>
          <ContactButtons site={site} quote={data.quotationNumber} className="mt-3" />
        </section>
      </div>
      <ActionBar data={data} />
    </Shell>
  )
}

/* ---------- helpers ---------- */

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
const fileUrl = (u?: string | null) => (!u ? '' : u.startsWith('/uploads/') ? API_ORIGIN + u : u)
const money = (v?: number | null) => {
  const n = Number(v ?? 0)
  const paise = Math.round(n * 100) % 100 !== 0
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })
}
const qty = (v?: number | null) => Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const date = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

type Site = ReturnType<typeof useSite>

/* ---------- Layout shell: brand only, no site navigation ---------- */
function Shell({ site, children }: { site: Site; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory print:bg-white">
      <header className="border-b border-forest/10 bg-forest print:border-0 print:bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <img src="/jb-decor-logo-sm.png" alt={site.name} className="h-9 w-auto rounded bg-white/95 p-0.5" />
          <span className="sr-only">{site.name}</span>
          <span className="ml-auto text-xs uppercase tracking-widest text-gold">Quotation</span>
        </div>
      </header>
      <main className="px-4 pt-5 print:px-0 print:pt-3">{children}</main>
    </div>
  )
}

function ContactButtons({ site, quote, className = '' }: { site: Site; quote?: string; className?: string }) {
  const wa = (site.whatsappNumber || '').replace(/\D/g, '')
  const text = quote ? `Hello, I have a question about quotation ${quote}.` : 'Hello'
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {site.phone && (
        <a href={`tel:${site.phone}`} className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-white px-4 py-2 text-sm font-medium text-forest hover:bg-forest/5">
          <Phone className="h-4 w-4" /> Call us
        </a>
      )}
      {wa && (
        <a href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-[#1F7A4D] px-4 py-2 text-sm font-medium text-white hover:bg-[#19663F]">
          <MessageCircle className="h-4 w-4" /> WhatsApp us
        </a>
      )}
    </div>
  )
}

/* ---------- State ---------- */
function StateBanner({ data }: { data: SharedQuote }) {
  const banners: Record<string, { cls: string; text: string } | undefined> = {
    ACCEPTED: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      text: `You accepted this quotation${data.acceptedAt ? ` on ${date(data.acceptedAt)}` : ''}. Our team will contact you shortly.` },
    APPROVED: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', text: 'This quotation is approved. Thank you for choosing us!' },
    REPLACED: { cls: 'bg-amber-50 text-amber-800 border-amber-200', text: 'This quotation has been replaced by a newer one. Please ask us for the latest link.' },
    CLOSED: { cls: 'bg-slate-50 text-slate-700 border-slate-200', text: 'This quotation is closed. Please contact us for an updated quote.' },
  }
  const b = banners[data.state]
  if (!b) return null
  return <div className={`rounded-xl border px-4 py-3 text-sm print:hidden ${b.cls}`}>{b.text}</div>
}

/* ---------- Header ---------- */
function HeaderCard({ data }: { data: SharedQuote }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-forest/50">Quotation</p>
          <h1 className="font-serif text-2xl font-semibold text-forest">{data.quotationNumber}</h1>
          {data.customerName && (
            <p className="mt-1 text-sm text-forest/70">Prepared for <span className="font-semibold text-forest">{data.customerName}</span></p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-forest/55">
            {data.quotationDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {date(data.quotationDate)}</span>}
            {data.expiryDate && <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Valid until {date(data.expiryDate)}</span>}
            {data.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {data.city}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-forest/50">Total</p>
          <p className="text-2xl font-bold tabular-nums text-forest">{money(data.grandTotal)}</p>
          <p className="text-xs text-forest/50">{data.items.length} item{data.items.length === 1 ? '' : 's'}{data.gst > 0 ? ' · incl. GST' : ''}</p>
        </div>
      </div>
    </section>
  )
}

/* ---------- Items, grouped by category ---------- */
const COLS = 'sm:grid-cols-[48px_minmax(0,1fr)_90px_100px_70px_110px]'

function Items({ items }: { items: SharedQuoteItem[] }) {
  const groups = useMemo(() => {
    const out: { category: string; items: SharedQuoteItem[]; total: number }[] = []
    for (const it of items) {
      let g = out.find((x) => x.category.toLowerCase() === it.category.toLowerCase())
      if (!g) { g = { category: it.category, items: [], total: 0 }; out.push(g) }
      g.items.push(it)
      g.total += Number(it.amount ?? 0)
    }
    return out
  }, [items])

  return (
    <>
      {groups.map((g) => (
        <section key={g.category} className="overflow-hidden rounded-2xl bg-white shadow-sm print:break-inside-avoid print:border print:border-forest/10 print:shadow-none">
          <div className="flex items-center justify-between gap-3 border-b border-forest/10 bg-forest/[0.04] px-4 py-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-forest">{g.category}</h2>
            <span className="text-sm font-semibold tabular-nums text-forest">{money(g.total)}</span>
          </div>
          {/* Column titles (tablet and up) */}
          <div className={`hidden gap-3 px-4 pt-2 text-[11px] font-medium uppercase tracking-wide text-forest/45 sm:grid ${COLS}`}>
            <span className="col-span-2">Item</span><span className="text-right">Qty</span><span className="text-right">Rate</span>
            <span className="text-right">Disc.</span><span className="text-right">Amount</span>
          </div>
          <ul className="divide-y divide-forest/[0.07]">
            {g.items.map((it, i) => <ItemRow key={i} it={it} />)}
          </ul>
        </section>
      ))}
    </>
  )
}

function ItemRow({ it }: { it: SharedQuoteItem }) {
  const [broken, setBroken] = useState(false)
  const img = fileUrl(it.imageUrl)
  const hasDisc = Number(it.discount ?? 0) > 0
  const disc = hasDisc ? (it.discountPercent ? `${qty(it.discountPercent)}%` : money(it.discount)) : '—'
  const details = [it.description, it.color && `Colour: ${it.color}`, it.location].filter(Boolean).join(' · ')
  return (
    <li className={`grid grid-cols-[48px_minmax(0,1fr)] gap-3 px-4 py-3 sm:items-center ${COLS}`}>
      {img && !broken ? (
        <img src={img} alt="" onError={() => setBroken(true)} className="h-12 w-12 rounded-lg border border-forest/10 object-cover" />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-forest/10 bg-forest/[0.03]">
          <ImageIcon className="h-5 w-5 text-forest/25" />
        </span>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-forest">{it.name}</p>
        {details && <p className="mt-0.5 text-xs leading-relaxed text-forest/60">{details}</p>}
        {/* Phone: the numbers as one quiet line, amount on the right */}
        <div className="mt-1.5 flex items-baseline justify-between gap-2 sm:hidden">
          <span className="text-xs tabular-nums text-forest/60">
            {qty(it.quantity)} {it.unit} × {money(it.rate)}{hasDisc ? ` · −${disc}` : ''}
          </span>
          <span className="font-semibold tabular-nums text-forest">{money(it.amount)}</span>
        </div>
      </div>
      <span className="hidden text-right text-sm tabular-nums text-forest/80 sm:block">{qty(it.quantity)} <span className="text-forest/50">{it.unit}</span></span>
      <span className="hidden text-right text-sm tabular-nums text-forest/80 sm:block">{money(it.rate)}</span>
      <span className="hidden text-right text-sm tabular-nums text-forest/60 sm:block">{disc}</span>
      <span className="hidden text-right text-sm font-semibold tabular-nums text-forest sm:block">{money(it.amount)}</span>
    </li>
  )
}

/* ---------- Totals ---------- */
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 ${strong ? 'font-semibold text-forest' : 'text-forest/70'}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  )
}

function Summary({ data }: { data: SharedQuote }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm print:break-inside-avoid print:shadow-none">
      <div className="ml-auto max-w-sm text-sm">
        <Row label="Products total" value={money(data.productsTotal)} />
        {data.lineDiscount > 0 && <Row label="Item discounts" value={`− ${money(data.lineDiscount)}`} />}
        <Row label="Products net total" value={money(data.productsNet)} strong />
        {data.charges.map((c, i) => <Row key={i} label={c.note ? `${c.label} · ${c.note}` : c.label} value={money(c.amount)} />)}
        {data.discount > 0 && <Row label="Discount" value={`− ${money(data.discount)}`} />}
        {data.gst > 0 && <Row label={`GST${data.gstPercent ? ` (${qty(data.gstPercent)}%)` : ''}`} value={money(data.gst)} />}
        <div className="mt-2 flex items-baseline justify-between gap-4 rounded-xl bg-forest px-4 py-3 text-ivory">
          <span className="font-medium">Final price</span>
          <span className="text-xl font-bold tabular-nums">{money(data.grandTotal)}</span>
        </div>
      </div>
    </section>
  )
}

function Terms({ terms }: { terms: string[] }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm print:break-inside-avoid print:shadow-none">
      <h2 className="text-sm font-bold uppercase tracking-wide text-forest">Terms &amp; conditions</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-forest/70">
        {terms.map((t, i) => <li key={i}>{t}</li>)}
      </ol>
    </section>
  )
}

/* ---------- Accept ---------- */
function AcceptCard({ token, data, onChange }: { token: string; data: SharedQuote; onChange: (d: SharedQuote) => void }) {
  const [name, setName] = useState(data.customerName || '')
  const [note, setNote] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (data.state === 'ACCEPTED') {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 print:hidden">
        <BadgeCheck className="h-8 w-8 shrink-0 text-emerald-600" />
        <div className="text-sm text-emerald-900">
          <p className="font-semibold">Accepted by {data.acceptedName}</p>
          <p className="text-emerald-800/80">{data.acceptedAt && `${date(data.acceptedAt)} — `}our team will contact you to confirm the next steps.</p>
        </div>
      </section>
    )
  }
  if (data.state !== 'OPEN') return null

  const submit = async () => {
    if (!name.trim() || !agree || busy) return
    setBusy(true); setErr(null)
    try {
      onChange(await publicApi.acceptQuote(token, { name: name.trim(), note: note.trim() || undefined }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Could not send your acceptance. Please try again.')
    } finally { setBusy(false) }
  }
  const field = 'h-11 w-full rounded-xl border border-forest/15 px-3 text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/20'
  return (
    <section id="accept" className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-sm print:hidden">
      <h2 className="font-serif text-lg font-semibold text-forest">Happy with this quotation?</h2>
      <p className="mt-1 text-sm text-forest/60">Accept it here and our team will contact you to confirm the order and schedule the work.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-forest/60">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-forest/60">Message (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="e.g. Please start after the 15th" className={field} />
        </label>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-forest/70">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0B2B23]" />
        I accept quotation {data.quotationNumber} for {money(data.grandTotal)} and its terms.
      </label>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <button type="button" onClick={submit} disabled={!name.trim() || !agree || busy}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-ivory disabled:opacity-40">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept quotation
      </button>
    </section>
  )
}

/* ---------- Sticky actions: PDF / print / accept ---------- */
function ActionBar({ data }: { data: SharedQuote }) {
  const pdf = fileUrl(data.pdfUrl)
  const btn = 'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm sm:flex-none'
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-forest/10 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2.5">
        <span className="mr-auto hidden items-center gap-1.5 text-sm text-forest/70 sm:flex">
          <FileText className="h-4 w-4" /> {data.quotationNumber} · <b className="tabular-nums text-forest">{money(data.grandTotal)}</b>
        </span>
        {pdf ? (
          <a href={pdf} target="_blank" rel="noopener noreferrer" className={`${btn} border border-forest/20 font-medium text-forest`}>
            <Download className="h-4 w-4" /> Download PDF
          </a>
        ) : (
          <button type="button" onClick={() => window.print()} className={`${btn} border border-forest/20 font-medium text-forest`}>
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        )}
        {data.state === 'OPEN' && (
          <a href="#accept" className={`${btn} bg-forest font-semibold text-ivory`}>
            <Check className="h-4 w-4" /> Accept
          </a>
        )}
      </div>
    </div>
  )
}
