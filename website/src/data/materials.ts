import type { Material } from '@/types'
import { images } from '@/config/images'

// Reuse verified stock imagery; swap for real material swatches later via images.ts.
const M = images.portfolio

export const materialCategories = [
  'Wood', 'Veneer', 'Laminate', 'Marble', 'Granite', 'Glass',
  'Fabric', 'Wallpaper', 'Hardware', 'Flooring',
] as const

export const materials: Material[] = [
  {
    id: 1,
    name: 'Natural Teak Wood',
    slug: 'natural-teak-wood',
    category: 'Wood',
    image: M.residential,
    description: 'Premium seasoned teak with a rich, warm grain — a timeless choice for joinery and furniture.',
    finish: 'Hand-oiled matte',
    color: 'Golden Brown',
    applications: ['Furniture', 'Flooring', 'Panelling', 'Doors'],
  },
  {
    id: 2,
    name: 'Smoked Oak Veneer',
    slug: 'smoked-oak-veneer',
    category: 'Veneer',
    image: M.villa,
    description: 'Fine-cut smoked oak veneer that lends depth and character to wardrobes and wall units.',
    finish: 'Natural PU',
    color: 'Ash Grey',
    applications: ['Wardrobes', 'Wall Units', 'Ceilings'],
  },
  {
    id: 3,
    name: 'Carrara Marble',
    slug: 'carrara-marble',
    category: 'Marble',
    image: M.kitchen,
    description: 'Classic Italian Carrara marble with soft grey veining — the signature of a luxury surface.',
    finish: 'Polished',
    color: 'White & Grey',
    applications: ['Countertops', 'Flooring', 'Cladding'],
  },
  {
    id: 4,
    name: 'Forest Green Granite',
    slug: 'forest-green-granite',
    category: 'Granite',
    image: M.bedroom,
    description: 'Deep green granite with subtle flecks — durable, dramatic, and distinctly premium.',
    finish: 'Leathered',
    color: 'Forest Green',
    applications: ['Kitchen Tops', 'Vanity', 'Flooring'],
  },
  {
    id: 5,
    name: 'Matte Suede Laminate',
    slug: 'matte-suede-laminate',
    category: 'Laminate',
    image: M.apartment,
    description: 'Anti-fingerprint suede-touch laminate for a refined, low-maintenance finish.',
    finish: 'Suede Matte',
    color: 'Ivory',
    applications: ['Cabinetry', 'Shutters', 'Panels'],
  },
  {
    id: 6,
    name: 'Fluted Glass',
    slug: 'fluted-glass',
    category: 'Glass',
    image: M.office,
    description: 'Reeded fluted glass that diffuses light beautifully across partitions and cabinet fronts.',
    finish: 'Reeded',
    color: 'Clear',
    applications: ['Partitions', 'Cabinet Fronts', 'Doors'],
  },
  {
    id: 7,
    name: 'Belgian Linen Fabric',
    slug: 'belgian-linen-fabric',
    category: 'Fabric',
    image: M.residential,
    description: 'Soft, breathable Belgian linen upholstery in a warm neutral palette.',
    finish: 'Woven',
    color: 'Warm Ivory',
    applications: ['Upholstery', 'Drapery', 'Cushions'],
  },
  {
    id: 8,
    name: 'Grasscloth Wallpaper',
    slug: 'grasscloth-wallpaper',
    category: 'Wallpaper',
    image: M.villa,
    description: 'Handwoven natural grasscloth that adds organic texture to feature walls.',
    finish: 'Textured',
    color: 'Sage',
    applications: ['Feature Walls', 'Headboards', 'Ceilings'],
  },
  {
    id: 9,
    name: 'Brushed Brass Hardware',
    slug: 'brushed-brass-hardware',
    category: 'Hardware',
    image: M.kitchen,
    description: 'Solid brushed-brass handles and profiles that elevate every cabinet.',
    finish: 'Brushed',
    color: 'Antique Gold',
    applications: ['Handles', 'Profiles', 'Fittings'],
  },
  {
    id: 10,
    name: 'Herringbone Wood Flooring',
    slug: 'herringbone-wood-flooring',
    category: 'Flooring',
    image: M.bedroom,
    description: 'Engineered herringbone flooring for a classic, elegant underfoot statement.',
    finish: 'Lacquered',
    color: 'Honey Oak',
    applications: ['Living', 'Bedrooms', 'Studies'],
  },
]

export function getMaterial(slug: string) {
  return materials.find((m) => m.slug === slug)
}
