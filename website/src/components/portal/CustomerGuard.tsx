import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { isAuthenticated } from '@/lib/auth'

/**
 * Guards the /portal subtree. Unauthenticated users go to /login (remembering where they
 * were headed). This is UI-level only — the backend's ROLE_CUSTOMER + ownership checks are
 * the real gate on every /api/portal/** call.
 */
export function CustomerGuard({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
