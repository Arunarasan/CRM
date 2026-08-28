import type { FaqItem } from '@/components/ui/Accordion'
import { images } from '@/config/images'

export interface ProcessStep {
  title: string
  description: string
}

export interface ServiceDetail {
  overview: string
  benefits: string[]
  process: ProcessStep[]
  materials: string[]
  gallery: string[]
  faq: FaqItem[]
}

const galleryPool = [
  images.services.interiorDesign,
  images.services.turnkey,
  images.services.modularKitchen,
  images.services.lighting,
]

const genericProcess: ProcessStep[] = [
  { title: 'Consultation', description: 'We listen to your needs, budget, and taste, and survey the space in detail.' },
  { title: 'Concept & Design', description: 'Our designers develop layouts, 3D concepts, and material palettes for your approval.' },
  { title: 'Quotation & Planning', description: 'A transparent quotation and timeline, with milestones you can track.' },
  { title: 'Execution', description: 'Skilled craftspeople bring the design to life under close supervision.' },
  { title: 'Handover', description: 'A final walkthrough, quality check, and warranty — your space, ready to enjoy.' },
]

const genericFaq: FaqItem[] = [
  {
    question: 'How long does a typical project take?',
    answer: 'Timelines depend on scope, but most residential projects run 6–12 weeks from design sign-off to handover. We share a milestone schedule up front.',
  },
  {
    question: 'Do you provide a detailed quotation?',
    answer: 'Yes. Every engagement includes an itemised, transparent quotation with no hidden costs, reviewed with you before work begins.',
  },
  {
    question: 'Is there a warranty?',
    answer: 'All our work carries a service warranty, and we remain available for after-service support long after handover.',
  },
]

/** Rich detail content keyed by service slug; unknown slugs fall back to a sensible default. */
const details: Record<string, Partial<ServiceDetail>> = {
  'interior-design': {
    overview:
      'From the first sketch to the final styling, our interior design service shapes spaces that are as functional as they are beautiful. We balance architecture, light, material, and detail to create interiors with a lasting sense of calm and luxury.',
    benefits: [
      'Dedicated designer and single point of contact',
      'Photorealistic 3D visualisation before execution',
      'Curated material and finish palettes',
      'Transparent, itemised quotations',
    ],
    materials: ['Premium Veneers', 'Italian Marble', 'Solid Wood', 'Brushed Brass', 'Belgian Linen'],
  },
  'modular-kitchen': {
    overview:
      'A JB Decor kitchen is engineered around the way you cook and gather. Ergonomic layouts, premium hardware, and durable, easy-clean surfaces come together in a space that works as beautifully as it looks.',
    benefits: [
      'Ergonomic work-triangle planning',
      'Soft-close premium hardware',
      'Moisture-resistant, easy-clean finishes',
      'Tailored storage for every utensil',
    ],
    materials: ['Suede Laminate', 'Quartz Countertops', 'Brushed Brass Hardware', 'Fluted Glass'],
  },
  'wardrobe-design': {
    overview:
      'Bespoke wardrobes designed around your wardrobe — not the other way around. Every shelf, drawer, and hanging zone is planned for how you actually live, then finished to a flawless standard.',
    benefits: [
      'Made-to-measure internal planning',
      'Integrated lighting options',
      'Premium shutter and veneer finishes',
      'Soft-close, full-extension fittings',
    ],
    materials: ['Smoked Oak Veneer', 'Matte Laminate', 'Fluted Glass', 'Brushed Brass'],
  },
  'lighting-design': {
    overview:
      'Great lighting is invisible until you feel it. We layer ambient, task, and accent lighting to shape mood, highlight architecture, and make every material sing — day and night.',
    benefits: [
      'Layered ambient, task, and accent design',
      'Smart-control and dimming options',
      'Architectural cove and profile lighting',
      'Energy-efficient premium fixtures',
    ],
    materials: ['LED Profiles', 'Designer Fixtures', 'Smart Controls', 'Brass Detailing'],
  },
}

export function getServiceDetail(slug: string): ServiceDetail {
  const d = details[slug] ?? {}
  return {
    overview:
      d.overview ??
      'Our team brings craftsmanship, transparency, and an eye for detail to every engagement — delivering a finished space that feels considered in every corner.',
    benefits: d.benefits ?? [
      'Dedicated design team',
      'Premium materials and finishes',
      'Transparent, milestone-based delivery',
      'Service warranty and after-care',
    ],
    process: d.process ?? genericProcess,
    materials: d.materials ?? ['Premium Woods', 'Natural Stone', 'Designer Hardware', 'Quality Fabrics'],
    gallery: d.gallery ?? galleryPool,
    faq: d.faq ?? genericFaq,
  }
}
