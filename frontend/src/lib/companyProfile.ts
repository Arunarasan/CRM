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

/** Bank / UPI details printed on quotations (Settings › Company). Signed-in users only. */
export interface BankDetails {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  upiId?: string;
}

export function fetchBankDetails(): Promise<BankDetails> {
  return api.get<Record<string, string>>("/website/bank-details")
    .then((r) => {
      const m = (r.data ?? {}) as Record<string, string>;
      const v = (k: string) => m[k]?.trim() || undefined;
      return {
        accountName: v("bank.account_name"), bankName: v("bank.name"), accountNumber: v("bank.account_number"),
        ifsc: v("bank.ifsc"), branch: v("bank.branch"), upiId: v("bank.upi_id"),
      };
    })
    .catch(() => ({}));
}
