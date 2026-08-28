import { Quote } from 'lucide-react'
import type { Testimonial } from '@/types'
import { Rating } from '@/components/ui/Rating'

export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex h-full flex-col gap-4 border border-forest/10 bg-white p-6 shadow-card sm:gap-5 sm:p-8">
      <Quote className="h-7 w-7 text-gold sm:h-8 sm:w-8" />
      <blockquote className="flex-1 font-serif text-base leading-relaxed text-forest/85 sm:text-lg">
        “{testimonial.quote}”
      </blockquote>
      <Rating value={testimonial.rating} />
      <figcaption className="border-t border-forest/10 pt-4">
        <div className="font-semibold text-forest">{testimonial.name}</div>
        <div className="text-sm text-forest/55">
          {testimonial.role} · {testimonial.location}
        </div>
      </figcaption>
    </figure>
  )
}
