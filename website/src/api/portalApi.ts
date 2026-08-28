import api from '@/lib/api'

/** Customer portal endpoints — all self-scoped on the backend to the signed-in customer. */
export const portalApi = {
  dashboard: () => api.get('/portal/dashboard').then((r) => r.data),
  profile: () => api.get('/portal/profile').then((r) => r.data),
  updateProfile: (updates: Record<string, string>) =>
    api.put('/portal/profile', updates).then((r) => r.data),

  projects: () => api.get('/portal/projects').then((r) => r.data),
  project: (id: number | string) => api.get(`/portal/projects/${id}`).then((r) => r.data),

  quotations: () => api.get('/portal/quotations').then((r) => r.data),
  invoices: () => api.get('/portal/invoices').then((r) => r.data),
  payments: () => api.get('/portal/payments').then((r) => r.data),
  documents: () => api.get('/portal/documents').then((r) => r.data),
  orders: () => api.get('/portal/orders').then((r) => r.data),

  serviceRequests: () => api.get('/portal/service-requests').then((r) => r.data),
  createServiceRequest: (body: Record<string, unknown>) =>
    api.post('/portal/service-requests', body).then((r) => r.data),

  services: () => api.get('/portal/services').then((r) => r.data),
  reviewService: (serviceId: number, rating: number, comment: string) =>
    api.post(`/portal/services/${serviceId}/review`, { rating, comment }).then((r) => r.data),

  notifications: () => api.get('/portal/notifications').then((r) => r.data),
  markNotificationRead: (id: number) =>
    api.post(`/portal/notifications/${id}/read`).then((r) => r.data),
}
