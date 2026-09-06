import { getAuthorities, getRoleNames } from "@/hooks/useAuth";

/**
 * The login flow stores only token + userRoles (no display name), so we derive a friendly
 * name and role label for the header/greeting from what's actually available:
 *   • name  → the JWT subject's local-part (before @), title-cased; falls back to "there"
 *   • role  → a human label from the highest ROLE_* authority
 * Purely presentational — never used for access decisions (the backend enforces those).
 */

function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      )
    );
    return json.sub || json.username || json.email || null;
  } catch {
    return null;
  }
}

function titleCase(s: string): string {
  return s
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: "Administrator",
  ROLE_PROJECT_MANAGER: "Project Manager",
  ROLE_SALES: "Sales",
  ROLE_ACCOUNTANT: "Accounts",
  ROLE_HR: "HR",
  ROLE_PURCHASE: "Purchase",
  ROLE_EMPLOYEE: "Team Member",
};

export function getCurrentUser(): { name: string; role: string; initial: string } {
  const token = localStorage.getItem("token") || "";
  const sub = decodeJwtSub(token) || "";
  const local = sub.includes("@") ? sub.split("@")[0] : sub;
  const name = local ? titleCase(local) : "there";

  const roles = getRoleNames(getAuthorities());
  const role =
    roles.map((r) => ROLE_LABELS[r]).find(Boolean) ||
    (roles[0] ? titleCase(roles[0].replace(/^ROLE_/, "")) : "Team");

  return { name, role, initial: (name[0] || "U").toUpperCase() };
}
