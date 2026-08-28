import { Section, SectionHeading } from '@/components/ui/Section'
import { testimonials as testimonialsSeed } from '@/data/siteContent'
import { TestimonialCard } from '@/components/cards/TestimonialCard'
import { usePublicData } from '@/hooks/usePublicData'
import { publicApi } from '@/api/publicApi'

export function Testimonials() {
  const testimonials = usePublicData(testimonialsSeed, publicApi.testimonials)
  return (
    <Section tone="white">
      <SectionHeading eyebrow="Client Stories" title="What Our Clients Say" align="center" />
      <div className="grid gap-6 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </div>
    </Section>
  )
}
