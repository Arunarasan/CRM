import api from "@/lib/api";

/** Which printed document a design belongs to. */
export type DocKind = "quotation" | "invoice";

/**
 * What a printed quotation / invoice shows. Edited in Website › Document Design, stored as JSON in the
 * `doc.design.<kind>` setting, and read by both the PDF builder and the print preview.
 */
export interface DocDesign {
  letterhead: boolean;
  /** Replaces the QUOTATION / TAX INVOICE heading when set. */
  titleText: string;
  // Info cards
  showDateCard: boolean;
  showCustomerCard: boolean;
  /** Area / GSTIN line under the customer name. */
  showCustomerDetail: boolean;
  showSiteCard: boolean;
  // Items table
  categoryHeader: boolean;
  categoryTotal: boolean;
  colPhoto: boolean;
  colTag: boolean;
  colDescription: boolean;
  colQty: boolean;
  colUnit: boolean;
  colRate: boolean;
  /** Discount % (quotation) or GST % (invoice). */
  colExtra: boolean;
  // Bottom
  showTerms: boolean;
  showBank: boolean;
  showQr: boolean;
  /** Printed under the terms / bank box and in the page footer, e.g. "Goods once sold…". */
  footerText: string;
  /** Invoices: terms & conditions prefilled on every new invoice (one point per line). */
  defaultTerms: string;
  showFooter: boolean;
  // Print preview only (the PDF has no signature block)
  showSignatures: boolean;
  showContact: boolean;
}

export const DEFAULT_DESIGN: DocDesign = {
  letterhead: true, titleText: "",
  showDateCard: true, showCustomerCard: true, showCustomerDetail: true, showSiteCard: true,
  categoryHeader: true, categoryTotal: true,
  colPhoto: true, colTag: true, colDescription: true, colQty: true, colUnit: true, colRate: true, colExtra: true,
  showTerms: true, showBank: true, showQr: true, footerText: "", defaultTerms: "", showFooter: true,
  showSignatures: true, showContact: true,
};

export const designKey = (k: DocKind) => `doc.design.${k}`;

export function parseDesign(raw?: string | null): DocDesign {
  try {
    const o = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_DESIGN, ...(o && typeof o === "object" ? o : {}) };
  } catch { return { ...DEFAULT_DESIGN }; }
}

let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

function loadAll(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = api.get<Record<string, string>>("/website/document-design")
    .then((r) => (cache = (r.data ?? {}) as Record<string, string>))
    .catch(() => ({} as Record<string, string>))
    .finally(() => { inflight = null; });
  return inflight;
}

/** The saved design for a document (defaults when none saved or the call fails). */
export async function fetchDocDesign(kind: DocKind): Promise<DocDesign> {
  return parseDesign((await loadAll())[designKey(kind)]);
}

/** Forget the cached designs (after saving in the editor). */
export function resetDocDesignCache() { cache = null; }

export const designApi = {
  save: (kind: DocKind, d: DocDesign) =>
    api.put("/website/settings", { settings: [{ key: designKey(kind), value: JSON.stringify(d) }] })
      .then(() => resetDocDesignCache()),
};
