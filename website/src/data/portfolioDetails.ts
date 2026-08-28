import { images } from '@/config/images'

export interface PortfolioDetail {
  concept: string
  gallery: string[]
  materials: string[]
  services: string[]
  highlights: string[]
  testimonial?: { quote: string; name: string; role: string }
}

const galleryPool = [
  images.portfolio.residential,
  images.portfolio.villa,
  images.portfolio.apartment,
  images.portfolio.kitchen,
  images.portfolio.bedroom,
  images.portfolio.office,
]

const details: Record<string, Partial<PortfolioDetail>> = {
  'emerald-residence': {
    concept:
      'A contemporary family home wrapped in warm woods, forest-green accents, and soft brass. The brief was calm luxury — a home that feels expensive without ever feeling cold.',
    materials: ['Teak Wood', 'Carrara Marble', 'Forest Green Granite', 'Brushed Brass'],
    services: ['Interior Design', 'Modular Kitchen', 'False Ceiling', 'Lighting Design'],
    highlights: [
      'Double-height living with a sculptural chandelier',
      'Handcrafted teak-and-brass kitchen',
      'Layered lighting throughout',
    ],
    testimonial: {
      quote: 'JB Decor turned our house into a home we never want to leave. Every detail felt considered.',
      name: 'Ananya Rao',
      role: 'Homeowner',
    },
  },
  'hillcrest-villa': {
    concept:
      'A hillside villa that frames the landscape. Natural materials and an earthy palette let the interiors recede so the views take centre stage.',
    materials: ['Smoked Oak', 'Local Stone', 'Belgian Linen', 'Antique Brass'],
    services: ['Turnkey Interiors', 'Custom Furniture', 'Lighting Design'],
    highlights: ['Floor-to-ceiling glazing', 'Bespoke oak joinery', 'Warm, layered lighting scheme'],
  },
}

export function getPortfolioDetail(slug: string): PortfolioDetail {
  const d = details[slug] ?? {}
  return {
    concept:
      d.concept ??
      'A considered interior that balances form and function — designed, sourced, and executed end-to-end by the JB Decor studio.',
    gallery: d.gallery ?? galleryPool,
    materials: d.materials ?? ['Premium Wood', 'Natural Stone', 'Designer Hardware', 'Quality Fabrics'],
    services: d.services ?? ['Interior Design', 'Turnkey Interiors', 'Lighting Design'],
    highlights: d.highlights ?? ['Bespoke joinery', 'Layered lighting', 'Premium finishes throughout'],
    testimonial: d.testimonial,
  }
}
