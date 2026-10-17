/**
 * Where the live address / phone numbers sit on the letterhead artwork (frontend/public/quote-header.jpg,
 * 2000 × 382 px). The image holds only the logo, curtains, pin icon and gold rule; the text comes from Settings → Company.
 * Used by the print preview (CSS), the PDF builder (mm) and the customer quote link (website copy of this file).
 */
import type { CompanyProfile } from "@/lib/companyProfile";

export const LH_W = 2000;
export const LH_H = 382;

/** Boxes in artwork pixels; text is centred vertically in each. `font` is px at 2000 wide. */
export const LH = {
  address: { x: 1122, y: 148, w: 640, h: 120, font: 31, line: 1.3 },
  phones: { x: 1112, y: 298, w: 660, h: 64, font: 30 },
  /** Gap between phone numbers; the "Ph:" label sits closer to the first. */
  gap: 40, labelGap: 12,
} as const;

/** Address lines: as typed (line breaks kept), blank lines dropped. */
export const addressText = (c: CompanyProfile) => (c.address ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" ");

/** The company's phone numbers (primary, then second), blanks dropped. */
export const phoneNumbers = (c: CompanyProfile) => [c.phone, c.phone2].map((p) => (p ?? "").trim()).filter(Boolean);
