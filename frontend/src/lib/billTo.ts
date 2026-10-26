import api from "@/lib/api";
import type { CompanyProfile } from "@/lib/companyProfile";

/** The customer's company details as printed on one quotation / invoice (editable per document). */
export interface BillTo {
  name?: string;
  gstin?: string;
  address?: string;
  state?: string;
  phone?: string;
  email?: string;
}

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * What to print under "Bill To": the document's own saved details first, then the customer record
 * (company name, billing address…), then the lead the quotation came from.
 */
export function resolveBillTo(customer?: any, lead?: any, saved?: BillTo | null): BillTo {
  const c = customer || {}, l = lead || {}, s = saved || {};
  const pick = (...v: unknown[]) => v.map(clean).find(Boolean) || undefined;
  return {
    name: pick(s.name, c.companyName, c.name, l.name),
    gstin: pick(s.gstin, c.gstNumber, l.gstNumber),
    address: pick(s.address, c.billingAddress, c.address, l.address, [l.area, l.city].filter(Boolean).join(", ")),
    state: pick(s.state, c.state, l.state),
    phone: pick(s.phone, c.phone, l.phone, l.mobile),
    email: pick(s.email, c.email, l.email),
  };
}

/** The lines of a party block, empty ones left out. */
export function billToLines(b: BillTo): string[] {
  return [
    b.address,
    b.state,
    [b.phone && `Ph: ${b.phone}`, b.email].filter(Boolean).join("  ·  "),
    b.gstin ? `GSTIN: ${b.gstin}` : "",
  ].filter((x): x is string => !!x);
}

/** Our own details, as the "From" block. */
export function fromLines(co: Partial<CompanyProfile>): string[] {
  return [
    co.address,
    [co.phone && `Ph: ${co.phone}`, co.phone2, co.email].filter(Boolean).join("  ·  "),
    co.gstin ? `GSTIN: ${co.gstin}` : "",
  ].filter((x): x is string => !!x);
}

/** Returns an error message for an invalid GSTIN (blank is allowed), else null. */
export function gstinError(v?: string): string | null {
  const g = clean(v);
  return !g || GSTIN_RE.test(g.toUpperCase()) ? null : "GSTIN should be 15 characters, e.g. 33ABCDE1234F1Z5";
}

/** Copy edited Bill To details onto the customer profile. */
export const saveBillToToCustomer = (customerId: number, b: BillTo) =>
  api.put(`/customers/${customerId}/bill-to`, b).then((r) => r.data);
