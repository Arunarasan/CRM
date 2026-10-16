import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuthorities, isFieldEmployeeOnly } from "@/hooks/useAuth";
import Login from "@/pages/Login";

function isAuthenticated(): boolean {
  return !!localStorage.getItem("token");
}

/**
 * The single sign-in for the whole platform lives on the public website (there is no separate CRM
 * login page). VITE_SITE_URL points at that website (already set for local dev); in the Option-A
 * production build it can be left empty, since the website is the same origin at root and the CRM
 * itself is served under "/crm", so "/login" resolves to the website. After signing in there, the
 * website persists the same-origin session and returns the user to the CRM.
 */
export const SIGN_IN_URL =
  (import.meta.env.VITE_SITE_URL || import.meta.env.VITE_WEBSITE_URL || "")
    .replace(/\/$/, "") + "/login";

/**
 * Full-page hand-off to the website sign-in (leaves the /crm SPA rather than routing within it).
 * If the target would resolve to this very page — local dev with no VITE_WEBSITE_URL, where the CRM
 * is served at root and owns "/login" — we fall back to rendering the login form inline instead of
 * looping. In production the website is a different app at "/login", so the hand-off always happens.
 */
export function RedirectToSignIn() {
  const target = new URL(SIGN_IN_URL, window.location.origin);
  const isSelf =
    target.origin === window.location.origin &&
    target.pathname === window.location.pathname;

  useEffect(() => {
    if (!isSelf) window.location.replace(SIGN_IN_URL);
  }, [isSelf]);

  return isSelf ? <Login /> : null;
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
    return <RedirectToSignIn />;
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
  if (!isAuthenticated()) {
    return <RedirectToSignIn />;
  }
  return <>{children}</>;
}
