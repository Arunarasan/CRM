// Central types + constants for the Quotation module.
// Mirrors backend Quotation/QuotationItem entities. Every quotation always references a Boq.

import type { EntityRef, QuotationMode } from "./boq";

export type QuotationItemStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface QuotationItem {
  id?: number;
  itemCode?: string;
  category?: string;
  itemName: string;
  productId?: number | null;
  imageUrl?: string | null;
  location?: string | null;
  /** Flat ₹ line discount (used when no percentage is set). */
  discountAmount?: number | null;
  description?: string;
  unit?: string;
  quantity?: number;
  rate?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  taxAmount?: number;
  totalAmount?: number;
  costAmount?: number;
  boqItemId?: number;
  status?: QuotationItemStatus;
  remarks?: string;
  // Floor -> Room -> Category hierarchy + ordering (carried from the linked BOQ)
  floorName?: string;
  roomName?: string;
  floorOrder?: number;
  roomOrder?: number;
  itemOrder?: number;
  // Measurement (read-only, carried from BOQ)
  length?: number;
  width?: number;
  height?: number;
  area?: number;
  // Material / labour split (drives room/floor/grand roll-ups)
  materialCost?: number;
  labourCost?: number;
  // Material-detail annotations (free-text)
  brand?: string;
  specification?: string;
  color?: string;
  thickness?: string;
  grade?: string;
  // Execution annotations
  estimatedDays?: number;
  assignedContractor?: string;
  // Per-item additional charge
  additionalCharges?: number;
}

export interface Quotation {
  id?: number;
  quotationNumber?: string;
  quotationDate?: string;
  expiryDate?: string;
  revisionNumber?: number;
  parentQuotationId?: number;
  isLatestVersion?: boolean;
  quotationMode?: QuotationMode;
  budgetCap?: number;
  customer?: EntityRef;
  lead?: EntityRef;
  siteVisit?: EntityRef;
  measurement?: EntityRef;
  boq?: EntityRef;
  project?: EntityRef;
  items?: QuotationItem[];
  discounts?: { discountType?: string; description?: string; percentage?: number | null; amount?: number | null }[];
  taxes?: { taxType?: string; percentage?: number | null; amount?: number | null; isInclusive?: boolean }[];
  /** Quote-level labour lines (older quotes). */
  labours?: { workType?: string; hours?: number | null; rate?: number | null; amount?: number | null }[];
  /** Quote-level charges — the pricing sheet sends "Labour" and "Shipping" here. */
  additionalCharges?: { chargeType?: string; amount?: number | null; description?: string | null }[];
  discount?: number;
  gst?: number;
  materialTotal?: number;
  labourTotal?: number;
  additionalChargesTotal?: number;
  grandTotal?: number;
  status?: string;
  priority?: string;
  currency?: string;
  termsAndConditions?: string;
  customerSignatureBase64?: string;
  internalApprovalStatus?: string;
  preparedBy?: EntityRef;
  /** Customer link (/q/{token}) sent by "Share Quote"; customerAccepted* = customer pressed Accept on it. */
  shareToken?: string | null;
  shareEnabled?: boolean;
  customerAcceptedAt?: string | null;
  customerAcceptedName?: string | null;
  customerAcceptNote?: string | null;
  approvedBy?: EntityRef;
  approvedDate?: string;
  createdAt?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export const QUOTATION_STATUSES = [
  "DRAFT", "SENT", "UNDER_REVIEW", "NEGOTIATION", "APPROVED", "REVISED", "CONVERTED", "REJECTED",
];

export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  UNDER_REVIEW: "Under Review",
  NEGOTIATION: "Negotiation",
  APPROVED: "Approved",
  REVISED: "Revised",
  CONVERTED: "Converted",
  REJECTED: "Rejected",
};

export const QUOTATION_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-emerald-100 text-emerald-700",
  UNDER_REVIEW: "bg-violet-100 text-violet-700",
  NEGOTIATION: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REVISED: "bg-orange-100 text-orange-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export const QUOTATION_ITEM_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

// ---------------------------------------------------------------------------
// Hierarchy grouping: flat QuotationItem[] -> Floor -> Room -> Category -> Item
// ---------------------------------------------------------------------------

/** Placeholders for backward compatibility with old flat quotations (null floor/room). */
export const DEFAULT_FLOOR = "General";
export const DEFAULT_ROOM = "General Room";
export const DEFAULT_CATEGORY = "General";

export interface QuotationCategoryGroup {
  category: string;
  items: QuotationItem[];
  material: number;
  labour: number;
  total: number;
}

export interface QuotationRoomGroup {
  room: string;
  categories: QuotationCategoryGroup[];
  itemCount: number;
  material: number;
  labour: number;
  total: number;
}

export interface QuotationFloorGroup {
  floor: string;
  rooms: QuotationRoomGroup[];
  itemCount: number;
  material: number;
  labour: number;
  total: number;
}

export interface QuotationTreeSummary {
  floors: QuotationFloorGroup[];
  material: number;
  labour: number;
  total: number;
}

const num = (v?: number | null) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

/**
 * Groups quotation items into a Floor -> Room -> Category -> Item tree, preserving the BOQ ordering
 * (floorOrder/roomOrder/itemOrder, then id) and rolling up material/labour/total at every level.
 * Null floor/room/category fall back to the "General" buckets so legacy flat quotations still render.
 */
export function buildQuotationTree(items: QuotationItem[] = []): QuotationTreeSummary {
  const floorMap = new Map<string, { order: number; rooms: Map<string, { order: number; cats: Map<string, QuotationItem[]> }> }>();

  for (const it of items) {
    const floor = it.floorName?.trim() || DEFAULT_FLOOR;
    const room = it.roomName?.trim() || DEFAULT_ROOM;
    const category = it.category?.trim() || DEFAULT_CATEGORY;
    if (!floorMap.has(floor)) floorMap.set(floor, { order: num(it.floorOrder), rooms: new Map() });
    const f = floorMap.get(floor)!;
    if (!f.rooms.has(room)) f.rooms.set(room, { order: num(it.roomOrder), cats: new Map() });
    const r = f.rooms.get(room)!;
    if (!r.cats.has(category)) r.cats.set(category, []);
    r.cats.get(category)!.push(it);
  }

  const itemSort = (a: QuotationItem, b: QuotationItem) =>
    num(a.itemOrder) - num(b.itemOrder) || num(a.id) - num(b.id);

  const floors: QuotationFloorGroup[] = [];
  let gMaterial = 0, gLabour = 0, gTotal = 0;

  for (const [floorName, f] of [...floorMap.entries()].sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))) {
    const rooms: QuotationRoomGroup[] = [];
    let fMaterial = 0, fLabour = 0, fTotal = 0, fCount = 0;

    for (const [roomName, r] of [...f.rooms.entries()].sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))) {
      const categories: QuotationCategoryGroup[] = [];
      let rMaterial = 0, rLabour = 0, rTotal = 0, rCount = 0;

      for (const [category, catItems] of r.cats.entries()) {
        const sorted = [...catItems].sort(itemSort);
        const material = sorted.reduce((s, i) => s + num(i.materialCost), 0);
        const labour = sorted.reduce((s, i) => s + num(i.labourCost), 0);
        const total = sorted.reduce((s, i) => s + num(i.totalAmount), 0);
        categories.push({ category, items: sorted, material, labour, total });
        rMaterial += material; rLabour += labour; rTotal += total; rCount += sorted.length;
      }
      rooms.push({ room: roomName, categories, itemCount: rCount, material: rMaterial, labour: rLabour, total: rTotal });
      fMaterial += rMaterial; fLabour += rLabour; fTotal += rTotal; fCount += rCount;
    }
    floors.push({ floor: floorName, rooms, itemCount: fCount, material: fMaterial, labour: fLabour, total: fTotal });
    gMaterial += fMaterial; gLabour += fLabour; gTotal += fTotal;
  }

  return { floors, material: gMaterial, labour: gLabour, total: gTotal };
}

// ---------------------------------------------------------------------------
// Category → Product layout (customer view, print, PDF)
// ---------------------------------------------------------------------------

export interface QuotationCategoryBlock {
  category: string;
  items: QuotationItem[];
  total: number;
}

/**
 * Groups lines by category in the same order as the quote sheet (floor/room/item order, then id).
 * Lines without a category land under "Others".
 */
export function buildCategoryBlocks(items: QuotationItem[] = []): QuotationCategoryBlock[] {
  const order = (i: QuotationItem) => [num(i.floorOrder), num(i.roomOrder), num(i.itemOrder), num(i.id)];
  const sorted = [...items].sort((a, b) => {
    const x = order(a), y = order(b);
    for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] - y[k];
    return 0;
  });
  const blocks: QuotationCategoryBlock[] = [];
  for (const it of sorted) {
    const name = it.category?.trim() || "Others";
    let b = blocks.find((x) => x.category.toLowerCase() === name.toLowerCase());
    if (!b) { b = { category: name, items: [], total: 0 }; blocks.push(b); }
    b.items.push(it);
    b.total += num(it.totalAmount);
  }
  return blocks;
}

/** Price before the line discount (rate × qty). */
export const lineGross = (it: QuotationItem) => num(it.rate) * num(it.quantity);

/** The line's own discount in ₹ (percentage or flat). */
export function lineDiscountAmount(it: QuotationItem): number {
  const gross = lineGross(it);
  if (num(it.discountPercentage) > 0) return Math.round(gross * num(it.discountPercentage)) / 100;
  return Math.min(num(it.discountAmount), gross);
}

/** Labour, shipping and any other quote-level charges, as label / amount / note rows. */
export function quoteCharges(q: Quotation): { label: string; amount: number; note?: string }[] {
  const out: { label: string; amount: number; note?: string }[] = [];
  const labourRows = (q.labours || []).filter((l) => num(l.amount) > 0);
  if (labourRows.length) {
    out.push({ label: "Labour", amount: labourRows.reduce((s, l) => s + num(l.amount), 0),
      note: labourRows.map((l) => l.workType).filter(Boolean).join(", ") || undefined });
  }
  (q.additionalCharges || []).filter((c) => num(c.amount) > 0).forEach((c) =>
    out.push({ label: c.chargeType || "Charges", amount: num(c.amount), note: c.description || undefined }));
  return out;
}

