import type { PortfolioProject } from '@/types'
import { images } from '@/config/images'

export const portfolioProjects: PortfolioProject[] = [
  {
    id: 1,
    title: 'The Emerald Residence',
    slug: 'emerald-residence',
    category: 'Residential',
    location: 'Bengaluru',
    year: 2025,
    image: images.portfolio.residential,
  },
  {
    id: 2,
    title: 'Hillcrest Villa',
    slug: 'hillcrest-villa',
    category: 'Villa',
    location: 'Coonoor',
    year: 2024,
    image: images.portfolio.villa,
  },
  {
    id: 3,
    title: 'Skyline Apartment',
    slug: 'skyline-apartment',
    category: 'Apartment',
    location: 'Mumbai',
    year: 2025,
    image: images.portfolio.apartment,
  },
  {
    id: 4,
    title: 'Meridian Workspace',
    slug: 'meridian-workspace',
    category: 'Office',
    location: 'Hyderabad',
    year: 2024,
    image: images.portfolio.office,
  },
  {
    id: 5,
    title: 'The Culinary Loft',
    slug: 'culinary-loft',
    category: 'Kitchen',
    location: 'Pune',
    year: 2025,
    image: images.portfolio.kitchen,
  },
  {
    id: 6,
    title: 'Serene Master Suite',
    slug: 'serene-master-suite',
    category: 'Bedroom',
    location: 'Chennai',
    year: 2024,
    image: images.portfolio.bedroom,
  },
]
