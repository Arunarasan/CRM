import { images } from '@/config/images'

export interface OptionGroup {
  key: string
  label: string
  multi?: boolean
  options: { value: string; swatch?: string[] }[]
}

/** Configurator option groups — structured so this can later be backed by the catalog/API. */
export const designGroups: OptionGroup[] = [
  {
    key: 'room',
    label: 'Room',
    options: [
      { value: 'Living Room' }, { value: 'Bedroom' }, { value: 'Kitchen' },
      { value: 'Dining' }, { value: 'Office' },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    options: [
      { value: 'Modern Luxury' }, { value: 'Classic' }, { value: 'Minimalist' }, { value: 'Art Deco' },
    ],
  },
  {
    key: 'palette',
    label: 'Palette',
    options: [
      { value: 'Forest & Gold', swatch: ['#0B2B23', '#D6A84F', '#F7F3EA'] },
      { value: 'Ivory & Oak', swatch: ['#F7F3EA', '#C8A97E', '#8B6B43'] },
      { value: 'Charcoal & Brass', swatch: ['#2B2B2B', '#B8903F', '#E6E1D6'] },
      { value: 'Emerald & Cream', swatch: ['#0F5132', '#E9E4D6', '#CBB26A'] },
    ],
  },
  {
    key: 'furniture',
    label: 'Furniture',
    options: [{ value: 'Luxury Sofa' }, { value: 'Accent Chairs' }, { value: 'Modular Seating' }],
  },
  {
    key: 'lighting',
    label: 'Lighting',
    options: [{ value: 'Chandelier' }, { value: 'Cove Lighting' }, { value: 'Floor Lamps' }],
  },
  {
    key: 'flooring',
    label: 'Flooring',
    options: [{ value: 'Italian Marble' }, { value: 'Herringbone Wood' }, { value: 'Large Format Tile' }],
  },
  {
    key: 'materials',
    label: 'Materials',
    multi: true,
    options: [{ value: 'Marble' }, { value: 'Wood' }, { value: 'Brass' }, { value: 'Glass' }],
  },
  {
    key: 'decor',
    label: 'Décor',
    multi: true,
    options: [{ value: 'Vases' }, { value: 'Wall Art' }, { value: 'Plants' }, { value: 'Mirrors' }],
  },
]

export const roomPreviewImage: Record<string, string> = {
  'Living Room': images.hero.livingRoom,
  Bedroom: images.portfolio.bedroom,
  Kitchen: images.portfolio.kitchen,
  Dining: images.hero.diningHall,
  Office: images.portfolio.office,
}
