import api from '../lib/api';

/**
 * Website / CMS management API (`/api/website/**`, admin-gated by WEBSITE_READ/WEBSITE_WRITE).
 * Edits here write to the same tables the public site reads via `/api/public/**`, so changes are
 * live on the marketing site on its next fetch. Mirrors the backend WebsiteAdminDto records.
 */

export interface SpecRow { label: string; value: string }
export interface ColorVariant { name: string; hex: string; image?: string }
export interface ProcessStep { title: string; description: string }
export interface FaqItem { question: string; answer: string }
export interface TestimonialBlock { quote: string; name: string; role: string }

export interface Category {
  id?: number; name: string; slug?: string; icon?: string;
  displayOrder?: number; active?: boolean;
}

export interface Product {
  id?: number; name: string; slug?: string; sku?: string; categoryId?: number | null;
  shortDescription?: string; description?: string; imageUrl?: string;
  price?: number; discountPrice?: number | null; stock?: number;
  rating?: number; reviewCount?: number; featured?: boolean; active?: boolean;
  material?: string; dimensions?: string;
  gallery?: string[]; specifications?: SpecRow[]; colors?: ColorVariant[];
}

export interface Service {
  id?: number; title: string; slug?: string; shortDescription?: string; imageUrl?: string; icon?: string;
  overview?: string; benefits?: string[]; materialsList?: string[];
  process?: ProcessStep[]; faq?: FaqItem[];
  displayOrder?: number; active?: boolean;
}

export interface Material {
  id?: number; name: string; slug?: string; category?: string; imageUrl?: string;
  description?: string; finish?: string; color?: string; applications?: string[];
  displayOrder?: number; active?: boolean;
}

export interface Portfolio {
  id?: number; title: string; slug?: string; category?: string; location?: string; year?: number | null;
  coverImage?: string; concept?: string; gallery?: string[];
  materialsList?: string[]; servicesList?: string[]; highlights?: string[];
  testimonial?: TestimonialBlock | null; displayOrder?: number; active?: boolean;
}

export interface HeroSlide {
  id?: number; imageUrl?: string; eyebrow?: string; title?: string; titleAccent?: string; description?: string;
  primaryButtonText?: string; primaryButtonLink?: string;
  secondaryButtonText?: string; secondaryButtonLink?: string;
  displayOrder?: number; active?: boolean;
}

export interface Testimonial {
  id?: number; name: string; role?: string; location?: string; rating?: number; quote?: string;
  displayOrder?: number; active?: boolean;
}

/** Builds the standard list/create/update/delete/toggle set for one resource path. */
function crud<T extends { id?: number }>(path: string) {
  return {
    list: () => api.get<T[]>(`/website/${path}`).then((r) => r.data),
    create: (body: T) => api.post<T>(`/website/${path}`, body).then((r) => r.data),
    update: (id: number, body: T) => api.put<T>(`/website/${path}/${id}`, body).then((r) => r.data),
    remove: (id: number) => api.delete(`/website/${path}/${id}`),
    toggle: (id: number) => api.patch<T>(`/website/${path}/${id}/toggle`).then((r) => r.data),
  };
}

// ---- Shop orders (created by the public checkout; managed here) ----
export interface OrderSummary {
  id: number; orderNumber: string; customerName?: string;
  status: string; paymentStatus: string; paymentMethod?: string;
  total: number; itemCount: number; placedAt?: string;
}

export interface OrderItemView {
  id: number; productId?: number | null; productName: string; sku?: string;
  unitPrice: number; qty: number; lineTotal: number;
}

export interface OrderDetail extends OrderSummary {
  customerId?: number | null;
  paymentRef?: string; subtotal: number; deliveryFee: number;
  contactName?: string; contactPhone?: string; contactEmail?: string;
  deliveryAddress?: string; city?: string; pincode?: string;
  items: OrderItemView[];
}

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'REFUNDED'] as const;

export const ordersApi = {
  list: (status?: string) =>
    api.get<OrderSummary[]>('/website/orders', { params: status ? { status } : {} }).then((r) => r.data),
  get: (id: number) => api.get<OrderDetail>(`/website/orders/${id}`).then((r) => r.data),
  updateStatus: (id: number, status: string) =>
    api.patch<OrderDetail>(`/website/orders/${id}/status`, { status }).then((r) => r.data),
  updatePayment: (id: number, paymentStatus: string, paymentRef?: string) =>
    api.patch<OrderDetail>(`/website/orders/${id}/payment`, { paymentStatus, paymentRef }).then((r) => r.data),
};

// ---- Service requests (raised from the customer portal; managed here) ----
export interface ServiceRequestSummary {
  id: number; subject: string; customerName?: string;
  issueType?: string; priority: string; status: string;
  hasMedia: boolean; createdAt?: string;
}

export interface ServiceRequestMediaView { id: number; url: string; mediaType?: string }

export interface ServiceRequestDetail extends ServiceRequestSummary {
  description?: string;
  customerId?: number | null; customerPhone?: string; customerEmail?: string;
  preferredDate?: string; projectId?: number | null; projectName?: string;
  taskId?: number | null; media: ServiceRequestMediaView[];
}

export const SERVICE_REQUEST_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export const serviceRequestsApi = {
  list: (status?: string) =>
    api.get<ServiceRequestSummary[]>('/website/service-requests', { params: status ? { status } : {} }).then((r) => r.data),
  get: (id: number) => api.get<ServiceRequestDetail>(`/website/service-requests/${id}`).then((r) => r.data),
  updateStatus: (id: number, status: string) =>
    api.patch<ServiceRequestDetail>(`/website/service-requests/${id}/status`, { status }).then((r) => r.data),
  reply: (id: number, message: string) =>
    api.post<ServiceRequestDetail>(`/website/service-requests/${id}/reply`, { message }).then((r) => r.data),
};

// ---- Site settings (brand / contact / social) ----
export interface SiteSetting {
  id?: number; key: string; value?: string; group?: string; label?: string;
  inputType?: string; displayOrder?: number;
}

export const settingsApi = {
  list: () => api.get<SiteSetting[]>('/website/settings').then((r) => r.data),
  saveAll: (settings: { key: string; value: string }[]) =>
    api.put<SiteSetting[]>('/website/settings', { settings }).then((r) => r.data),
};

// ---- Page content blocks ----
export interface ContentBlock {
  id?: number; page: string; sectionKey: string;
  title?: string; subtitle?: string; body?: string;
  displayOrder?: number; active?: boolean;
}

// ---- Service reviews (written by customers in the portal; moderated here) ----
export interface ServiceReview {
  id: number; serviceTitle?: string; customerName?: string;
  rating: number; comment?: string; status: string; createdAt?: string;
}

export const reviewsApi = {
  list: () => api.get<ServiceReview[]>('/website/service-reviews').then((r) => r.data),
  setStatus: (id: number, status: string) =>
    api.patch(`/website/service-reviews/${id}/status`, { status }).then((r) => r.data),
  remove: (id: number) => api.delete(`/website/service-reviews/${id}`).then((r) => r.data),
};

export const websiteAdminApi = {
  categories: crud<Category>('categories'),
  products: crud<Product>('products'),
  services: crud<Service>('services'),
  materials: crud<Material>('materials'),
  portfolio: crud<Portfolio>('portfolio'),
  heroSlides: crud<HeroSlide>('hero-slides'),
  testimonials: crud<Testimonial>('testimonials'),
  content: crud<ContentBlock>('content'),
  orders: ordersApi,
  serviceRequests: serviceRequestsApi,
  settings: settingsApi,
  reviews: reviewsApi,
};
