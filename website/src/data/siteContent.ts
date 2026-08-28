import type { Testimonial, Feature } from '@/types'

export const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Ananya Rao',
    role: 'Homeowner',
    location: 'Bengaluru',
    rating: 5,
    quote:
      'JB Decor turned our apartment into something we never want to leave. Every detail felt considered, and the execution was flawless.',
  },
  {
    id: 2,
    name: 'Rahul Menon',
    role: 'Managing Director',
    location: 'Hyderabad',
    rating: 5,
    quote:
      'They delivered our office fit-out on time and on budget. The team is professional, transparent, and genuinely talented.',
  },
  {
    id: 3,
    name: 'Priya & Karthik',
    role: 'Villa Owners',
    location: 'Coonoor',
    rating: 5,
    quote:
      'From the first sketch to handover, it was a calm, luxurious experience. The craftsmanship speaks for itself.',
  },
]

export const whyChooseFeatures: Feature[] = [
  {
    id: 1,
    icon: 'Gem',
    title: 'Premium Quality',
    description: 'Luxury materials and finishes, sourced and finished to last.',
  },
  {
    id: 2,
    icon: 'Palette',
    title: 'Custom Designs',
    description: 'Tailored to your style, space, and the way you live.',
  },
  {
    id: 3,
    icon: 'Truck',
    title: 'On-Time Delivery',
    description: 'Committed timelines, tracked milestones, no surprises.',
  },
  {
    id: 4,
    icon: 'Users',
    title: 'Expert Team',
    description: 'Professional designers, architects, and craftspeople.',
  },
  {
    id: 5,
    icon: 'Wrench',
    title: 'Installation',
    description: 'Seamless, supervised, and completely hassle-free.',
  },
  {
    id: 6,
    icon: 'ShieldCheck',
    title: 'Warranty',
    description: 'Assured quality with dependable after-service support.',
  },
]
