import { images } from '@/config/images'
import type { Product } from '@/types'

export interface ProductDetail {
  description: string
  specifications: { label: string; value: string }[]
  gallery: string[]
}

const P = images.products
const galleryPool = [P.chandelier, P.velvetChair, P.coffeeTable, P.sofa, P.sideboard, P.tableLamp]

/** Rich detail per product; falls back to sensible defaults built from the product itself. */
const overrides: Record<string, Partial<ProductDetail>> = {
  'crystal-gold-chandelier': {
    description:
      'A statement crystal chandelier hand-finished with a warm gold frame. Cut-crystal droplets scatter light beautifully across a room, while the solid brass structure ensures it remains a centrepiece for years. Ideal above a dining table or in a double-height foyer.',
    specifications: [
      { label: 'Material', value: 'Cut Crystal, Solid Brass' },
      { label: 'Dimensions', value: '80 × 80 × 100 cm' },
      { label: 'Finish', value: 'Antique Gold' },
      { label: 'Bulb Type', value: 'E14 · 8 lamps' },
      { label: 'Warranty', value: '2 Years' },
    ],
  },
  'luxury-velvet-chair': {
    description:
      'A deep-seated accent chair upholstered in sumptuous forest velvet, set on a slim gold-tone frame. Equal parts comfort and sculpture — perfect beside a fireplace or in a reading nook.',
    specifications: [
      { label: 'Material', value: 'Velvet, Stainless Steel' },
      { label: 'Dimensions', value: '75 × 80 × 90 cm' },
      { label: 'Colour', value: 'Forest Green' },
      { label: 'Seat Height', value: '45 cm' },
      { label: 'Warranty', value: '3 Years' },
    ],
  },
}

export function getProductDetail(product: Product): ProductDetail {
  const o = overrides[product.slug] ?? {}
  return {
    description:
      o.description ??
      `${product.shortDescription} Crafted to JB Decor's premium standard, this piece brings a considered, luxurious finish to any space.`,
    specifications:
      o.specifications ?? [
        { label: 'SKU', value: product.sku },
        { label: 'Material', value: 'Premium Composite' },
        { label: 'Dimensions', value: 'Made to order' },
        { label: 'Warranty', value: '1 Year' },
      ],
    gallery: o.gallery ?? [product.image, ...galleryPool.filter((g) => g !== product.image)].slice(0, 4),
  }
}
