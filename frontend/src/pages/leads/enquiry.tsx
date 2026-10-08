import { Blinds, Footprints, Grid3x3, Shapes, Sofa, Theater, type LucideIcon } from "lucide-react";
import { ENQUIRY_TYPES, type Lead } from "./constants";

// Helpers for a lead's enquiry tag (Product / Service / Others) so every screen that shows
// "what the customer asked for" reads it the same way.

export const splitList = (v?: string | null) =>
  (v || "").split(",").map((s) => s.trim()).filter(Boolean);

/** Effective enquiry type — legacy leads without a tag count as PRODUCT when they carry products. */
export function enquiryTypeOf(lead: Partial<Lead>): string | undefined {
  if (lead.enquiryType) return lead.enquiryType;
  if (lead.requirementService) return "SERVICE";
  if (lead.requirementOther) return "OTHER";
  if (lead.requirementCategory || lead.requirementProduct) return "PRODUCT";
  return undefined;
}

export function enquiryLabel(type?: string) {
  return ENQUIRY_TYPES.find((t) => t.value === type)?.label;
}

const TAG_STYLES: Record<string, string> = {
  PRODUCT: "bg-emerald-100 text-emerald-700",
  SERVICE: "bg-violet-100 text-violet-700",
  OTHER: "bg-amber-100 text-amber-700",
};

export function EnquiryTag({ type, className = "" }: { type?: string; className?: string }) {
  const label = enquiryLabel(type);
  if (!label) return null;
  return (
    <span className={`px-2 py-0.5 text-[11px] rounded-full font-semibold uppercase tracking-wide ${TAG_STYLES[type!] || ""} ${className}`}>
      {label}
    </span>
  );
}

/** The service / other detail of a lead as chip labels (empty for product enquiries). */
export function enquiryDetails(lead: Partial<Lead>): string[] {
  return [...splitList(lead.requirementService), ...(lead.requirementOther ? [lead.requirementOther] : [])];
}

// Main product categories shown as quick-filter cards on the lead lists. A lead's category is
// matched by keyword (first hit wins), so catalog names like "Netlon (Mosquito Nets)" and older
// free-text ones like "Flooring" land in the right card; anything else falls into Others.
export type CategoryGroupKey = "NETLON" | "CURTAINS" | "BLINDS" | "FLOOR_MATS" | "FURNISHING" | "OTHERS";
export const CATEGORY_GROUPS: { key: CategoryGroupKey; label: string; icon: LucideIcon; tone: string; match?: RegExp }[] = [
  { key: "NETLON", label: "Netlon", icon: Grid3x3, tone: "bg-sky-100 text-sky-700", match: /netlon|mosquito/i },
  { key: "CURTAINS", label: "Curtains", icon: Theater, tone: "bg-rose-100 text-rose-700", match: /curtain/i },
  { key: "BLINDS", label: "Blinds", icon: Blinds, tone: "bg-violet-100 text-violet-700", match: /blind/i },
  { key: "FLOOR_MATS", label: "Floor Mats", icon: Footprints, tone: "bg-amber-100 text-amber-700", match: /mats?|floor|carpet/i },
  { key: "FURNISHING", label: "Furnishing", icon: Sofa, tone: "bg-emerald-100 text-emerald-700", match: /furnish|home decor|sofa|bed cover|cushion/i },
  { key: "OTHERS", label: "Others", icon: Shapes, tone: "bg-slate-200 text-slate-700" },
];

/** Group of a category — or, for a lead's comma-separated list, of its first grouped category. */
export function categoryGroupOf(category?: string | null): CategoryGroupKey {
  for (const c of splitList(category)) {
    const g = CATEGORY_GROUPS.find((x) => x.match?.test(c));
    if (g) return g.key;
  }
  return "OTHERS";
}
