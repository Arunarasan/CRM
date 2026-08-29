import api from '@/lib/api'
import type { Product, Category, Service, PortfolioProject, Material, HeroSlide, Testimonial, ColorVariant } from '@/types'

/** Rich product detail served by /public/products/{slug} — superset of Product with detail fields. */
export interface ApiProductDetail extends Product {
  description?: string
  material?: string
  dimensions?: string
  gallery?: string[]
  specifications?: { label: string; value: string }[]
  colors?: ColorVariant[]
}

/**
 * Public catalog API (`/api/public/**`, unauthenticated). The backend DTO field names mirror these
 * TypeScript types exactly, so responses drop straight into the same components. Every call is used
 * behind `usePublicData`, which falls back to local seed data if the API is unavailable — so the
 * site stays fully functional standalone and simply upgrades to live content when the backend is up.
 */
export const publicApi = {
  heroSlides: () => api.get<HeroSlide[]>('/public/hero-slides').then((r) => r.data),
  categories: () => api.get<Category[]>('/public/categories').then((r) => r.data),
  products: () => api.get<Product[]>('/public/products').then((r) => r.data),
  featuredProducts: () => api.get<Product[]>('/public/products?featured=true').then((r) => r.data),
  product: (slug: string) => api.get<ApiProductDetail>(`/public/products/${slug}`).then((r) => r.data),
  services: () => api.get<Service[]>('/public/services').then((r) => r.data),
  portfolio: () => api.get<PortfolioProject[]>('/public/portfolio').then((r) => r.data),
  materials: () => api.get<Material[]>('/public/materials').then((r) => r.data),
  testimonials: () => api.get<Testimonial[]>('/public/testimonials').then((r) => r.data),

  // Website enquiries → CRM leads
  submitContact: (payload: Record<string, unknown>) =>
    api.post('/public/leads', payload).then((r) => r.data),
  submitConsultation: (payload: Record<string, unknown>) =>
    api.post('/public/consultations', payload).then((r) => r.data),

  // Shop checkout → CRM order
  checkout: (payload: CheckoutPayload) =>
    api.post('/public/orders', payload).then((r) => r.data as OrderResult),

  // CMS-managed settings + page content
  settings: () => api.get<Record<string, string>>('/public/settings').then((r) => r.data),
  content: (page: string) =>
    api.get<ContentBlock[]>(`/public/content/${page}`).then((r) => r.data),

  // Public, no-login project tracking (link-only)
  track: (token: string) =>
    api.get<TrackingData>(`/public/track/${token}`).then((r) => r.data),
  trackSubmitRequest: (token: string, payload: Record<string, unknown>) =>
    api.post(`/public/track/${token}/requests`, payload).then((r) => r.data),
  trackSubmitReview: (token: string, payload: Record<string, unknown>) =>
    api.post(`/public/track/${token}/reviews`, payload).then((r) => r.data),
}

export interface TrackingStep {
  name: string
  status: 'DONE' | 'CURRENT' | 'PENDING'
  percent?: number
  startDate?: string
  endDate?: string
}

export interface TrackingUpdate {
  time?: string
  description: string
}

export interface TrackingReview {
  reviewerName?: string
  rating: number
  comment?: string
  date?: string
}

export interface TrackingData {
  projectName: string
  projectCode?: string
  status: string
  progress: number
  projectType?: string
  propertyAddress?: string
  startDate?: string
  expectedCompletionDate?: string
  actualCompletionDate?: string
  customerNotes?: string
  currentActivity?: string
  timeline: TrackingStep[]
  updates: TrackingUpdate[]
  reviews: TrackingReview[]
}

export interface ContentBlock {
  id: number
  page: string
  sectionKey: string
  title?: string
  subtitle?: string
  body?: string
  displayOrder?: number
  active?: boolean
}

export interface CheckoutPayload {
  name: string
  phone: string
  email: string
  address: string
  city: string
  pincode: string
  paymentMethod: string
  items: { productId: number; qty: number }[]
}

export interface OrderResult {
  id: number
  orderNumber: string
  subtotal: number
  deliveryFee: number
  total: number
  status: string
}
