import type { Service } from '@/types'

// Compiled-in fallback for the live CMS services (CRM › Website › Services), shown until
// /api/public/services responds and used by site search. Mirrors the real JB Decor services (V96).
const R2 = 'https://pub-a71206d0d22147c19f60595314aec002.r2.dev/catalog/services'

export const services: Service[] = [
  {
    id: 1,
    title: 'Measurement Service',
    slug: 'measurement-service',
    shortDescription: 'Our team visits your site to take accurate measurements for curtains, blinds, nets and interiors.',
    image: `${R2}/measurement-service/srv-measure-01.jpg`,
    icon: 'PencilRuler',
  },
  {
    id: 2,
    title: 'Tailoring & Stitching',
    slug: 'tailoring-stitching',
    shortDescription: 'In-house tailoring and stitching for curtains, cushions and soft furnishings.',
    image: `${R2}/tailoring-stitching/srv-stitch-01.jpg`,
    icon: 'Gem',
  },
  {
    id: 3,
    title: 'Installation & Fitting',
    slug: 'installation-fitting',
    shortDescription: 'Professional installation of curtains, rods, blinds, nets and wall decor.',
    image: `${R2}/installation-fitting/srv-install-01.jpg`,
    icon: 'Wrench',
  },
]

export function getService(slug: string) {
  return services.find((s) => s.slug === slug)
}
