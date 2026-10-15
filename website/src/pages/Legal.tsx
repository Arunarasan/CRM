import { PageHeader } from '@/components/ui/PageHeader'
import { useSeo } from '@/hooks/useSeo'
import { useSite } from '@/hooks/useSiteSettings'

type DocKey = 'privacy' | 'terms' | 'refund'

interface Section {
  heading: string
  body: string[]
}

function docs(name: string, email: string, phone: string, address: string): Record<DocKey, { title: string; description: string; sections: Section[] }> {
  const contact = `You can reach us at ${email}, ${phone}, or ${address}.`
  return {
    privacy: {
      title: 'Privacy Policy',
      description: `How ${name} collects, uses and protects the information you share with us.`,
      sections: [
        { heading: 'Information we collect', body: [
          'When you send an enquiry, book a consultation or request a quotation, we collect the details you give us — your name, phone number, email address, site address, and any measurements, photos or notes about your project.',
          'Our site also records basic technical information (such as browser type and pages visited) to keep it working and to understand how it is used.',
        ] },
        { heading: 'How we use it', body: [
          'We use your information only to respond to your enquiry, arrange site visits and measurements, prepare quotations, deliver and install your order, and provide after-sales service.',
          'We do not sell your personal information. We share it only with the people who need it to serve you — for example our measurement, stitching and installation team — or where the law requires.',
        ] },
        { heading: 'Storage and security', body: [
          'Your information is stored on secured systems with restricted access. We keep it for as long as needed to serve you and meet our legal and accounting obligations.',
        ] },
        { heading: 'Your choices', body: [
          'You may ask us to correct or delete the personal information we hold about you, or to stop contacting you, at any time.',
          contact,
        ] },
      ],
    },
    terms: {
      title: 'Terms of Service',
      description: `The terms that apply when you use the ${name} website and order from us.`,
      sections: [
        { heading: 'Using this website', body: [
          `This website is operated by ${name}. By using it you agree to these terms. Product images and colours are indicative; fabric shades can vary slightly by screen and by batch.`,
        ] },
        { heading: 'Quotations and orders', body: [
          'Prices are confirmed in a written quotation prepared after on-site measurement. A quotation is valid for the period stated on it, and an order is confirmed once the agreed advance is received.',
          'Made-to-measure products are produced to the measurements and specifications approved on the quotation.',
        ] },
        { heading: 'Delivery and installation', body: [
          'Delivery and installation dates are estimates agreed at the time of order and may shift for reasons outside our control. We will keep you informed of any change.',
        ] },
        { heading: 'Liability', body: [
          `${name} is responsible for the quality of the goods and workmanship it supplies. We are not liable for indirect losses, or for issues arising from incorrect information or access provided at the site.`,
        ] },
        { heading: 'Contact', body: [contact] },
      ],
    },
    refund: {
      title: 'Refund Policy',
      description: `How ${name} handles cancellations, returns and refunds.`,
      sections: [
        { heading: 'Made-to-measure products', body: [
          'Curtains, blinds, mosquito nets and other items cut, stitched or fabricated to your measurements are made specially for you and are generally not returnable once production has started.',
        ] },
        { heading: 'Cancellations', body: [
          'You may cancel an order before production begins. Any advance paid will be refunded, less costs already incurred for materials ordered or work done on your behalf.',
        ] },
        { heading: 'Defects and errors', body: [
          'If a product arrives faulty, or does not match the approved quotation, tell us within 7 days of delivery or installation. We will repair, remake or replace it, or refund the affected portion where that is not possible.',
        ] },
        { heading: 'Standard stock items', body: [
          'Unused, undamaged ready-made items in original condition can be returned within 7 days of purchase with the bill.',
        ] },
        { heading: 'How refunds are paid', body: [
          'Approved refunds are returned through the original mode of payment where possible.',
          contact,
        ] },
      ],
    },
  }
}

/** Privacy / Terms / Refund — one template, three documents. */
export default function Legal({ doc }: { doc: DocKey }) {
  const site = useSite()
  const d = docs(site.name, site.email, site.phone, site.address)[doc]
  useSeo({ title: d.title, description: d.description })
  return (
    <>
      <PageHeader eyebrow="Legal" title={d.title} description={d.description} crumbs={[{ label: 'Home', to: '/' }, { label: d.title }]} />
      <section className="bg-ivory">
        <div className="container max-w-3xl py-12 md:py-16">
          {d.sections.map((s) => (
            <div key={s.heading} className="mb-8">
              <h2 className="font-serif text-2xl font-semibold text-forest">{s.heading}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-forest/70">{p}</p>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
