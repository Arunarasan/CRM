/**
 * Reads the authorities array Login.tsx already writes to localStorage as "userRoles"
 * after a successful /auth/login call (it holds both role names like ROLE_ADMIN and
 * fine-grained permission names like CUSTOMER_FINANCIAL_READ — see JwtUtil/
 * CustomUserDetailsService on the backend, which put both into the same authorities set).
 *
 * This is UI-level, defense-in-depth gating only (hide buttons/tabs a user can't use) —
 * the backend's @PreAuthorize checks are the actual enforcement.
 */
export function getAuthorities(): string[] {
  try {
    const raw = localStorage.getItem("userRoles");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry: any) =>
      typeof entry === "string" ? entry : entry?.authority ?? String(entry)
    );
  } catch {
    return [];
  }
}

/** Just the role entries (ROLE_*), dropping fine-grained permissions. */
export function getRoleNames(authorities: string[]): string[] {
  return authorities.filter((a) => a.startsWith("ROLE_"));
}

/**
 * A "field employee" is a portal-only user: they hold ROLE_EMPLOYEE and are NOT an admin.
 * Such users are redirected to /employee and blocked from the desktop ERP entirely — matching
 * the spec (employees never see HR/finance/quotations/etc.). Note this deliberately catches
 * employees who ALSO carry an operational role like ROLE_PROJECT_MANAGER (auto-granted from a
 * "manager" designation): being an employee wins, so they still land in the portal.
 *
 * Pure managers/staff who are NOT employees (e.g. ROLE_PROJECT_MANAGER without ROLE_EMPLOYEE)
 * and admins keep full desktop access.
 */
export function isFieldEmployeeOnly(authorities: string[]): boolean {
  const roles = getRoleNames(authorities);
  return roles.includes("ROLE_EMPLOYEE") && !roles.includes("ROLE_ADMIN");
}

export function useAuth() {
  const authorities = getAuthorities();

  const hasAuthority = (name: string) =>
    authorities.includes(name) || authorities.includes("ROLE_ADMIN");

  const hasAnyAuthority = (names: string[]) => names.some(hasAuthority);

  return {
    authorities,
    roleNames: getRoleNames(authorities),
    isAdmin: authorities.includes("ROLE_ADMIN"),
    isFieldEmployee: isFieldEmployeeOnly(authorities),
    hasAuthority,
    hasAnyAuthority,
  };
}
