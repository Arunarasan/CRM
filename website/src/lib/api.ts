import axios from 'axios'

/**
 * Shared axios client for the public website + customer portal.
 * Talks to the SAME Spring Boot backend as the CRM (same-origin /api behind nginx).
 * Mirrors the CRM's token/refresh convention so a single auth system spans all three
 * experiences (public, portal, CRM).
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Unwrap the backend's { success, data } envelope, matching the CRM client.
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if (response.data.success) {
        response.data = response.data.data
        return response
      }
      return Promise.reject(new Error(response.data.message || 'Request failed'))
    }
    return response
  },
  (error) => Promise.reject(error),
)

export default api
