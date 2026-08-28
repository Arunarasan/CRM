import api from '@/lib/api'

export interface LoginResponse {
  token: string
  refreshToken: string
  email: string
  name: string
  roles: string[]
  mustChangePassword: boolean
}

/**
 * Auth endpoints. These hit /api/auth/** which the backend does NOT wrap in the {success,data}
 * envelope for login, so we read response.data directly (the api interceptor only unwraps when
 * the envelope is present).
 */
export const authApi = {
  // Portal accounts are created by staff in the CRM — there is no public self sign-up.
  login: (email: string, password: string, rememberMe = false) =>
    api.post<LoginResponse>('/auth/login', { email, password, rememberMe }).then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),
}
