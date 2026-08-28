import type { HeroSlide, Stat } from '@/types'
import { images } from '@/config/images'

export const heroSlides: HeroSlide[] = [
  {
    id: 1,
    image: images.hero.livingRoom,
    eyebrow: 'Crafting Spaces. Defining Luxury.',
    title: 'Designing Spaces That Inspire',
    titleAccent: 'Luxury',
    description:
      'Bespoke interiors that blend elegance, functionality, and craftsmanship — tailored just for you.',
    primaryButtonText: 'Book Consultation',
    primaryButtonLink: '/consultation',
    secondaryButtonText: 'Explore Portfolio',
    secondaryButtonLink: '/portfolio',
    displayOrder: 1,
    active: true,
  },
  {
    id: 2,
    image: images.hero.lounge,
    eyebrow: 'Turnkey Interior Solutions',
    title: 'From Blueprint to',
    titleAccent: 'Masterpiece',
    description:
      'End-to-end design, material sourcing, and flawless execution — one studio, one vision, one signature.',
    primaryButtonText: 'Start Your Project',
    primaryButtonLink: '/consultation',
    secondaryButtonText: 'View Our Work',
    secondaryButtonLink: '/portfolio',
    displayOrder: 2,
    active: true,
  },
  {
    id: 3,
    image: images.hero.diningHall,
    eyebrow: 'Premium Décor & Furniture',
    title: 'Curated Pieces for the',
    titleAccent: 'Refined Home',
    description:
      'A handpicked collection of lighting, furniture, and décor to complete every space with intention.',
    primaryButtonText: 'Shop Collection',
    primaryButtonLink: '/shop',
    secondaryButtonText: 'Design Studio',
    secondaryButtonLink: '/design-studio',
    displayOrder: 3,
    active: true,
  },
]

export const heroStats: Stat[] = [
  { id: 1, value: '4000+', label: 'Projects Completed', icon: 'Building2' },
  { id: 2, value: '16+', label: 'Years Experience', icon: 'Award' },
  { id: 3, value: '98%', label: 'Happy Clients', icon: 'Users' },
  { id: 4, value: '24/7', label: 'Dedicated Support', icon: 'Headphones' },
]
