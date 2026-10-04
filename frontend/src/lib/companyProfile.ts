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

/** JB Decor's own details — used when the settings can't be loaded or a field is blank there. */
export const COMPANY_FALLBACK: CompanyProfile = {
  name: "JB Decor",
  tagline: "Crafted for Quality. Styled for You.",
  address: "JB Decor, 64/82, North Car Street, Chidambaram, Cuddalore - 608 001",
  phone: "+91 95248 66006",
  email: "jbdecorcdm@gmail.com",
};

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
        name: m["brand.name"]?.trim() || COMPANY_FALLBACK.name,
        tagline: m["brand.tagline"]?.trim() || COMPANY_FALLBACK.tagline,
        address: m["contact.address"]?.trim() || COMPANY_FALLBACK.address,
        gstin: m["company.gst"]?.trim() || "",
        phone: m["contact.phone"]?.trim() || COMPANY_FALLBACK.phone,
        email: m["contact.email"]?.trim() || COMPANY_FALLBACK.email,
      };
      return cache;
    })
    .catch(() => (cache = { ...COMPANY_FALLBACK }))
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
