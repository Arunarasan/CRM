import api from "@/lib/api";

/** Shop / company identity for printed bills, from the CMS-managed site settings. */
export interface CompanyProfile {
  name: string;
  tagline?: string;
  address?: string;
  gstin?: string;
  phone?: string;
  email?: string;
}

const FALLBACK: CompanyProfile = { name: "ARUDRA", tagline: "Commercial Services" };

let cache: CompanyProfile | null = null;
let inflight: Promise<CompanyProfile> | null = null;

/**
 * Fetch the company profile from `/api/public/settings` (unauthenticated, no WEBSITE_READ
 * needed) and cache it for the session. Falls back to sensible defaults if unavailable.
 */
export function fetchCompanyProfile(): Promise<CompanyProfile> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = api.get<Record<string, string>>("/public/settings")
    .then((r) => {
      const m = (r.data ?? {}) as Record<string, string>;
      cache = {
        name: m["brand.name"]?.trim() || FALLBACK.name,
        tagline: m["brand.tagline"]?.trim() || FALLBACK.tagline,
        address: m["contact.address"]?.trim() || "",
        gstin: m["company.gst"]?.trim() || "",
        phone: m["contact.phone"]?.trim() || "",
        email: m["contact.email"]?.trim() || "",
      };
      return cache;
    })
    .catch(() => (cache = { ...FALLBACK }))
    .finally(() => { inflight = null; });
  return inflight;
}
