// Central types + constants for the Quotation module.
// Mirrors backend Quotation/QuotationItem entities. Every quotation always references a Boq.

import type { EntityRef, QuotationMode } from "./boq";

export type QuotationItemStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface QuotationItem {
  id?: number;
  itemCode?: string;
  category?: string;
  itemName: string;
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
  SENT: "bg-blue-100 text-blue-700",
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

const num = (v?: number) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

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
