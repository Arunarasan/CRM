import { useState, type FormEvent } from 'react'
import { Phone, Mail, MapPin, Clock, MessageCircle, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Input, Textarea, Select } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import { useSite, useWhatsappLink, usePageContent } from '@/hooks/useSiteSettings'
import { images } from '@/config/images'
import { publicApi } from '@/api/publicApi'
import { toast } from '@/store/toast'
import { useSeo } from '@/hooks/useSeo'

export default function Contact() {
  useSeo({ title: 'Contact Us', description: 'Get in touch with JB Decor — tell us about your space and book a consultation with our design team.' })
  const site = useSite()
  const whatsappHref = useWhatsappLink('Hello JB Decor, I have an enquiry.')
  const content = usePageContent('contact')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  // Creates a CRM lead (source: Website Contact) via /api/public/leads.
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setSending(true)
    try {
      await publicApi.submitContact({
        name: f.get('name'), phone: f.get('phone'), email: f.get('email'),
        projectType: f.get('projectType'), budget: f.get('budget'),
        location: f.get('location'), message: f.get('message'),
      })
      setSent(true)
    } catch {
      toast('Something went wrong. Please try again or call us.', 'error')
    } finally {
      setSending(false)
    }
  }

  const contactItems = [
    { icon: Phone, label: 'Call Us', value: site.phone, href: `tel:${site.phone}` },
    { icon: Mail, label: 'Email Us', value: site.email, href: `mailto:${site.email}` },
    { icon: MapPin, label: 'Visit Us', value: site.address },
    { icon: Clock, label: 'Business Hours', value: site.businessHours },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Get in Touch"
        title={content.text('intro', 'title', "Let's Talk")}
        description={content.text('intro', 'body',
          'Tell us about your space and your vision — our team will get back to you within one business day.')}
        image={images.consultationCta}
        crumbs={[{ label: 'Contact' }]}
      />

      <Section tone="ivory">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          {/* Contact info */}
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              {contactItems.map((item) => {
                const inner = (
                  <>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 text-gold">
                      <item.icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-forest/50">{item.label}</div>
                      <div className="mt-0.5 font-medium text-forest">{item.value}</div>
                    </div>
                  </>
                )
                return item.href ? (
                  <a key={item.label} href={item.href} className="flex items-start gap-3 border border-forest/10 bg-white p-5 transition-colors hover:border-gold/40">
                    {inner}
                  </a>
                ) : (
                  <div key={item.label} className="flex items-start gap-3 border border-forest/10 bg-white p-5">{inner}</div>
                )
              })}
            </div>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-3 bg-forest px-5 py-4 text-sm font-semibold uppercase tracking-wide text-ivory transition-colors hover:bg-forest-light"
            >
              <MessageCircle className="h-5 w-5 text-gold" /> Chat with us on WhatsApp
            </a>

            {/* Map placeholder */}
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex aspect-[16/9] items-center justify-center border border-forest/10 bg-forest-light/10 text-sm text-forest/50 transition-colors hover:text-gold-dark"
            >
              <MapPin className="mr-2 h-5 w-5" /> View on Google Maps
            </a>
          </div>

          {/* Form */}
          <div className="border border-forest/10 bg-white p-6 shadow-card md:p-8">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-14 w-14 text-gold" />
                <h2 className="mt-5 font-serif text-2xl font-semibold text-forest">Thank you!</h2>
                <p className="mt-2 max-w-sm text-forest/60">
                  Your message has reached the JB Decor team. We'll be in touch within one business day.
                </p>
                <Button className="mt-6" variant="outlineForest" onClick={() => setSent(false)}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" name="name" required placeholder="Your full name" />
                <Input label="Phone" name="phone" type="tel" required placeholder="+91 90000 00000" />
                <Input label="Email" name="email" type="email" required placeholder="you@email.com" />
                <Select label="Project Type" name="projectType" defaultValue="">
                  <option value="" disabled>Select…</option>
                  <option>Residential</option>
                  <option>Commercial</option>
                  <option>Office</option>
                  <option>Modular Kitchen</option>
                  <option>Turnkey Interior</option>
                  <option>Other</option>
                </Select>
                <Select label="Budget Range" name="budget" defaultValue="">
                  <option value="" disabled>Select…</option>
                  <option>Under ₹5 Lakh</option>
                  <option>₹5 – 15 Lakh</option>
                  <option>₹15 – 30 Lakh</option>
                  <option>₹30 Lakh +</option>
                </Select>
                <Input label="Location" name="location" placeholder="City / Area" />
                <Textarea label="Message" name="message" required placeholder="Tell us about your project…" className="sm:col-span-2" />
                <div className="sm:col-span-2">
                  <Button size="lg" className="w-full" disabled={sending}>{sending ? 'Sending…' : 'Send Message'}</Button>
                  <p className="mt-3 text-center text-xs text-forest/45">
                    Submitting creates an enquiry with our team. We never share your details.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </Section>
    </>
  )
}
