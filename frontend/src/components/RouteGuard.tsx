import { Navigate, useLocation } from "react-router-dom";
import { getAuthorities, isFieldEmployeeOnly } from "@/hooks/useAuth";

function isAuthenticated(): boolean {
  return !!localStorage.getItem("token");
}

/**
 * Guards the desktop ERP subtree (DashboardLayout). Unauthenticated users are sent to /login;
 * portal-only field employees are pushed to their /employee shell — the enforcement point for
 * "employees can access only their self-service portal, never HR/finance/admin". The backend
 * @PreAuthorize checks remain the real gate; this is defense-in-depth so an employee cannot even
 * render a desktop screen.
 */
export function DesktopGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (isFieldEmployeeOnly(getAuthorities())) {
    return <Navigate to="/employee" replace />;
  }
  return <>{children}</>;
}

/**
 * Guards the mobile employee portal subtree (MobileLayout). Any authenticated user may view it
 * (admins/managers can inspect it); unauthenticated users go to /login.
 */
export function EmployeeGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
