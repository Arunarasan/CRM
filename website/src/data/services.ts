import type { Service } from '@/types'
import { images } from '@/config/images'

const S = images.services

export const services: Service[] = [
  {
    id: 1,
    title: 'Interior Design',
    slug: 'interior-design',
    shortDescription: 'Full-scope residential and commercial design — concept, space planning, and styling.',
    image: S.interiorDesign,
    icon: 'PencilRuler',
  },
  {
    id: 2,
    title: 'Residential Interiors',
    slug: 'residential-interiors',
    shortDescription: 'Homes designed around how you live — warm, functional, and unmistakably yours.',
    image: S.turnkey,
    icon: 'Armchair',
  },
  {
    id: 3,
    title: 'Commercial Interiors',
    slug: 'commercial-interiors',
    shortDescription: 'Retail and hospitality spaces that express your brand and delight customers.',
    image: S.interiorDesign,
    icon: 'Building2',
  },
  {
    id: 4,
    title: 'Office Interiors',
    slug: 'office-interiors',
    shortDescription: 'Productive, on-brand workplaces engineered for focus and collaboration.',
    image: S.turnkey,
    icon: 'Briefcase',
  },
  {
    id: 5,
    title: 'Modular Kitchen',
    slug: 'modular-kitchen',
    shortDescription: 'Ergonomic, made-to-measure kitchens with premium finishes and hardware.',
    image: S.modularKitchen,
    icon: 'CookingPot',
  },
  {
    id: 6,
    title: 'Wardrobe Design',
    slug: 'wardrobe-design',
    shortDescription: 'Bespoke wardrobes and storage engineered around how you live.',
    image: S.wardrobe,
    icon: 'DoorClosed',
  },
  {
    id: 7,
    title: 'False Ceiling',
    slug: 'false-ceiling',
    shortDescription: 'Sculpted ceilings and cove detailing that elevate every room.',
    image: S.falseCeiling,
    icon: 'Layers',
  },
  {
    id: 8,
    title: 'Lighting Design',
    slug: 'lighting-design',
    shortDescription: 'Layered lighting schemes that shape mood, depth, and architecture.',
    image: S.lighting,
    icon: 'Lamp',
  },
  {
    id: 9,
    title: 'Custom Furniture',
    slug: 'custom-furniture',
    shortDescription: 'Made-to-order furniture crafted to your space and specification.',
    image: S.turnkey,
    icon: 'Armchair',
  },
  {
    id: 10,
    title: 'Turnkey Interiors',
    slug: 'turnkey-interiors',
    shortDescription: 'End-to-end delivery — design, sourcing, execution, and handover.',
    image: S.turnkey,
    icon: 'KeyRound',
  },
  {
    id: 11,
    title: 'Installation',
    slug: 'installation',
    shortDescription: 'Supervised, precise installation with a flawless finish, every time.',
    image: S.falseCeiling,
    icon: 'Wrench',
  },
  {
    id: 12,
    title: 'Renovation',
    slug: 'renovation',
    shortDescription: 'Thoughtful renovations that transform existing spaces without the guesswork.',
    image: S.modularKitchen,
    icon: 'PencilRuler',
  },
]

export function getService(slug: string) {
  return services.find((s) => s.slug === slug)
}
