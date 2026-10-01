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
