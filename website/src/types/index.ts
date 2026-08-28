/**
 * Shared domain types. These deliberately mirror the backend entities planned for
 * Phase 5 (Product, ProductCategory, Service, PortfolioProject, Material, HeroSlide,
 * Testimonial). Seed data conforms to these shapes, so swapping to live API responses
 * later is a data-source change, not a component change.
 */

export interface HeroSlide {
  id: number
  image: string
  eyebrow: string
  title: string
  titleAccent: string
  description: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText: string
  secondaryButtonLink: string
  displayOrder: number
  active: boolean
}

export interface Stat {
  id: number
  value: string
  label: string
  icon: string
}

export interface Category {
  id: number
  name: string
  slug: string
  icon: string
}

export interface Product {
  id: number
  name: string
  slug: string
  sku: string
  categorySlug: string
  shortDescription: string
  image: string
  price: number
  discountPrice?: number | null
  rating: number
  reviewCount: number
  featured: boolean
  inStock: boolean
}

/** A single colour/finish option for a product, shown as a swatch on the detail page. */
export interface ColorVariant {
  name: string
  /** CSS colour for the swatch dot (hex or named). */
  hex: string
  /** Optional image showing the product in this colour; falls back to the main gallery. */
  image?: string
}

export interface Service {
  id: number
  title: string
  slug: string
  shortDescription: string
  image: string
  icon: string
}

export interface PortfolioProject {
  id: number
  title: string
  slug: string
  category: string
  location: string
  year: number
  image: string
}

export interface Testimonial {
  id: number
  name: string
  role: string
  location: string
  rating: number
  quote: string
}

export interface Feature {
  id: number
  icon: string
  title: string
  description: string
}

export interface Material {
  id: number
  name: string
  slug: string
  category: string
  image: string
  description: string
  finish: string
  color: string
  applications: string[]
}
