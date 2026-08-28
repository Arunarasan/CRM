import type { Category } from '@/types'

// Lucide icon names — resolved at render via a shared icon map.
export const categories: Category[] = [
  { id: 1, name: 'Furniture', slug: 'furniture', icon: 'Armchair' },
  { id: 2, name: 'Lighting', slug: 'lighting', icon: 'Lamp' },
  { id: 3, name: 'Décor', slug: 'decor', icon: 'Flower2' },
  { id: 4, name: 'Curtains', slug: 'curtains', icon: 'Blinds' },
  { id: 5, name: 'Wallpaper', slug: 'wallpaper', icon: 'Wallpaper' },
  { id: 6, name: 'Kitchen Accessories', slug: 'kitchen-accessories', icon: 'CookingPot' },
  { id: 7, name: 'Wardrobes', slug: 'wardrobes', icon: 'DoorClosed' },
  { id: 8, name: 'Bathroom', slug: 'bathroom', icon: 'Bath' },
  { id: 9, name: 'Dining', slug: 'dining', icon: 'Utensils' },
  { id: 10, name: 'Office', slug: 'office', icon: 'Briefcase' },
]
