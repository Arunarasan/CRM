import { create } from 'zustand'

/**
 * Auth state for the website + customer portal. Mirrors the CRM's localStorage convention
 * (token / refreshToken / userRoles) so a single backend auth system spans all experiences.
 * The backend is the real gate; these values only drive UI and redirects.
 */
export interface AuthUser {
  name: string
  email: string
  roles: string[]
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setSession: (token: string, refreshToken: string | null, user: AuthUser) => void
  logout: () => void
}

function readUser(): AuthUser | null {
  try {
    const roles = JSON.parse(localStorage.getItem('userRoles') || '[]')
    const name = localStorage.getItem('userName') || ''
    const email = localStorage.getItem('userEmail') || ''
    if (!Array.isArray(roles) || (!name && !email)) return null
    return { name, email, roles }
  } catch {
    return null
  }
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: readUser(),
  setSession: (token, refreshToken, user) => {
    localStorage.setItem('token', token)
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('userRoles', JSON.stringify(user.roles))
    localStorage.setItem('userName', user.name)
    localStorage.setItem('userEmail', user.email)
    set({ token, user })
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userRoles')
    localStorage.removeItem('userName')
    localStorage.removeItem('userEmail')
    set({ token: null, user: null })
  },
}))

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token')
}

export function hasRole(roles: string[] | undefined, role: string): boolean {
  return !!roles?.includes(role)
}

/**
 * The website login is for CUSTOMERS only — a customer holds ROLE_CUSTOMER. Staff (admin,
 * employee, and other internal roles) sign in through the CRM app instead, so the website never
 * logs them in or holds their session. Anyone without ROLE_CUSTOMER is treated as staff here.
 */
export function isCustomer(roles: string[]): boolean {
  return roles.includes('ROLE_CUSTOMER')
}
