import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Check } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Input, Textarea, Select } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import { images } from '@/config/images'
import { publicApi } from '@/api/publicApi'
import { toast } from '@/store/toast'
import { useSeo } from '@/hooks/useSeo'

const assurances = [
  'A complimentary first consultation',
  'A dedicated designer for your project',
  'Transparent, itemised quotations',
  'No obligation — just expert guidance',
]

export default function Consultation() {
  useSeo({ title: 'Book a Free Consultation', description: 'Book a complimentary interior design consultation with JB Decor. Tell us about your space and get a dedicated designer, transparent quotes, and expert guidance.' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [params] = useSearchParams()
  const concept = params.get('concept') || ''

  // Creates a CRM lead (source: Website Consultation) via /api/public/consultations.
  // If an authenticated customer submits, the backend attaches it to their existing record.
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setSending(true)
    try {
      await publicApi.submitConsultation({
        name: f.get('name'), phone: f.get('phone'), email: f.get('email'),
        location: f.get('location'), propertyType: f.get('propertyType'),
        projectType: f.get('projectType'), area: f.get('area'),
        budget: f.get('budget'), preferredDate: f.get('preferredDate'),
        message: f.get('message'), concept,
      })
      setSent(true)
    } catch {
      toast('Something went wrong. Please try again or call us.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Let's Begin"
        title="Book a Consultation"
        description="Share a few details and our design team will reach out to schedule your complimentary consultation."
        image={images.consultationCta}
        crumbs={[{ label: 'Consultation' }]}
      />

      <Section tone="ivory">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
          {/* Value props */}
          <div>
            <span className="eyebrow"><span className="rule-gold" />What to Expect</span>
            <h2 className="mt-4 font-serif text-3xl font-semibold text-forest">Your journey starts here</h2>
            <p className="mt-4 leading-relaxed text-forest/70">
              Every great interior begins with a conversation. Tell us about your space, your taste, and
              your timeline — we'll take care of the rest.
            </p>
            <ul className="mt-8 space-y-4">
              {assurances.map((a) => (
                <li key={a} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-dark">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm text-forest/75">{a}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <div className="border border-forest/10 bg-white p-6 shadow-card md:p-8">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <CheckCircle2 className="h-14 w-14 text-gold" />
                <h2 className="mt-5 font-serif text-2xl font-semibold text-forest">Request received!</h2>
                <p className="mt-2 max-w-sm text-forest/60">
                  Thank you — our design team will contact you shortly to schedule your consultation.
                </p>
                <Button className="mt-6" variant="outlineForest" onClick={() => setSent(false)}>
                  Book another
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" name="name" required placeholder="Your full name" />
                <Input label="Phone" name="phone" type="tel" required placeholder="+91 90000 00000" />
                <Input label="Email" name="email" type="email" required placeholder="you@email.com" />
                <Input label="Location" name="location" placeholder="City / Area" />
                <Select label="Property Type" name="propertyType" defaultValue="">
                  <option value="" disabled>Select…</option>
                  <option>Apartment</option>
                  <option>Villa</option>
                  <option>Independent House</option>
                  <option>Office</option>
                  <option>Retail / Commercial</option>
                </Select>
                <Select label="Project Type" name="projectType" defaultValue="">
                  <option value="" disabled>Select…</option>
                  <option>Full Interior</option>
                  <option>Modular Kitchen</option>
                  <option>Wardrobes</option>
                  <option>Renovation</option>
                  <option>Furniture</option>
                </Select>
                <Input label="Approx. Area (sq ft)" name="area" type="number" placeholder="e.g. 1200" />
                <Select label="Budget Range" name="budget" defaultValue="">
                  <option value="" disabled>Select…</option>
                  <option>Under ₹5 Lakh</option>
                  <option>₹5 – 15 Lakh</option>
                  <option>₹15 – 30 Lakh</option>
                  <option>₹30 Lakh +</option>
                </Select>
                <Input label="Preferred Date" name="preferredDate" type="date" />
                <div className="hidden sm:block" />
                <Textarea label="Message" name="message" placeholder="Anything you'd like us to know…" className="sm:col-span-2" />
                {concept && (
                  <div className="rounded border border-gold/30 bg-gold/5 px-4 py-2.5 text-sm text-forest/70 sm:col-span-2">
                    Attaching your Design Studio concept: <span className="font-medium text-forest">{concept}</span>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Button size="lg" className="w-full" disabled={sending}>{sending ? 'Submitting…' : 'Request Consultation'}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Section>
    </>
  )
}
