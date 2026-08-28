import { Navigate, useLocation } from "react-router-dom";
import { getAuthorities, isFieldEmployeeOnly } from "@/hooks/useAuth";

function isAuthenticated(): boolean {
  return !!localStorage.getItem("token");
}

/**
 * Desktop workflow pages a field employee IS allowed to open — the lead-execution flow (Measurement,
 * Site Visit, BOQ, Quotation, and a lead's own page) that their workflow tasks deep-link into. Every
 * other desktop area (HR, finance, workforce, users, reports, inventory, purchases…) stays blocked.
 * The backend @PreAuthorize is the real gate; this just lets the full pages render for the employee.
 */
const FIELD_EMPLOYEE_DESKTOP_ALLOW = [
  "/measurements", "/site-visits", "/boq", "/quotations", "/leads",
];

/**
 * Guards the desktop ERP subtree (DashboardLayout). Unauthenticated users are sent to /login;
 * portal-only field employees are pushed to their /employee shell — EXCEPT on the workflow pages in
 * FIELD_EMPLOYEE_DESKTOP_ALLOW, which their tasks link into. The backend @PreAuthorize checks remain
 * the real gate; this is defense-in-depth so an employee cannot even render an admin/HR/finance screen.
 */
export function DesktopGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (isFieldEmployeeOnly(getAuthorities())) {
    const path = location.pathname;
    const allowed = FIELD_EMPLOYEE_DESKTOP_ALLOW.some(
      (p) => path === p || path.startsWith(p + "/"),
    );
    if (!allowed) {
      return <Navigate to="/employee" replace />;
    }
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
