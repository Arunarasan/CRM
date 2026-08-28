// Central types + constants for the BOQ (Bill of Quantities) module.
// Mirrors backend com.arudra.crm.service.BoqService constants and the Boq*/entities.

export interface EntityRef {
  id: number;
  name?: string;
  projectName?: string;
  measurementNumber?: string;
  quotationNumber?: string;
  boqNumber?: string;
  email?: string;
  roles?: string[];
  // Contact/address fields carried when the ref is a full Customer or Lead entity (server sends
  // the whole record). Customer and Lead use slightly different names, so both are optional here.
  mobileNumber?: string;
  phone?: string;
  whatsappNumber?: string;
  companyName?: string;
  contactPerson?: string;
  contactPersonName?: string;
  gstNumber?: string;
  address?: string;
  siteAddress?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export interface ProductRef {
  id: number;
  name?: string;
  sku?: string;
  unit?: string;
  price?: number;
  costPrice?: number;
  sellingPrice?: number;
  brand?: string;
  supplier?: { id: number; name?: string };
}

export interface BoqItemMaterial {
  id?: number;
  product?: ProductRef | { id: number };
  materialName: string;
  quantity?: number;
  unit?: string;
  wastePercent?: number;
  finalQuantity?: number;
  costPrice?: number;
  sellingRate?: number;
  amount?: number;
  vendor?: string;
  remarks?: string;
  stockWarning?: string;
  availableStock?: number;
}

export interface BoqItemLabour {
  id?: number;
  workType?: string;
  labourCategory?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  contractorName?: string;
  remarks?: string;
}

export type BoqItemStatus = "PENDING" | "SELECTED" | "APPROVED" | "EXECUTED" | "REJECTED";

export interface BoqItem {
  id?: number;
  itemCode?: string;
  category?: string;
  itemName: string;
  description?: string;
  floorName?: string;
  roomName?: string;
  measurementRoomId?: number;
  measurementItemId?: number;
  length?: number;
  width?: number;
  height?: number;
  area?: number;
  perimeter?: number;
  quantity?: number;
  unit?: string;
  status?: BoqItemStatus;
  remarks?: string;
  materials?: BoqItemMaterial[];
  labours?: BoqItemLabour[];
  materialTotal?: number;
  labourTotal?: number;
  amount?: number;
  isActive?: boolean;
  originItemId?: number;
  // Drag-and-drop layout order — sort key is (floorOrder, roomOrder, itemOrder, id).
  floorOrder?: number;
  roomOrder?: number;
  itemOrder?: number;
}

export interface BoqReorderEntry {
  itemId: number;
  floorName: string;
  roomName: string;
}

export interface BoqPhase {
  id?: number;
  phaseName: string;
  sequence?: number;
  status?: "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
  budget?: number;
  completionPercent?: number;
  quotationId?: number;
  isActive?: boolean;
}

export type BoqChangeType =
  | "ADD_FLOOR" | "REMOVE_FLOOR" | "ADD_ROOM" | "REMOVE_ROOM" | "ADD_ITEM" | "REMOVE_ITEM"
  | "QUANTITY_CHANGED" | "MATERIAL_CHANGED" | "DIMENSIONS_CHANGED" | "LABOUR_CHANGED"
  | "RATE_CHANGED" | "VENDOR_CHANGED" | "PHASE_SPLIT" | "PHASE_MERGED"
  | "ITEM_DISABLED" | "ITEM_ENABLED" | "PHASE_DISABLED" | "PHASE_ENABLED" | "ROOM_MOVED";

export interface BoqChangeLogEntry {
  id?: number;
  boqItem?: { id: number; itemName?: string };
  boqPhase?: { id: number; phaseName?: string };
  changeType: BoqChangeType;
  fieldName?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  modifiedBy?: EntityRef;
  modifiedDate: string;
  revisionNumber?: number;
}

export interface BoqFieldDiff {
  field: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface BoqItemDiffRow {
  itemId: number;
  itemName: string;
  floorName?: string;
  roomName?: string;
  amount?: number;
  changes?: BoqFieldDiff[];
}

export interface BoqDiff {
  fromRevision: number;
  toRevision: number;
  itemsAdded: BoqItemDiffRow[];
  itemsRemoved: BoqItemDiffRow[];
  itemsChanged: BoqItemDiffRow[];
  phasesAdded: string[];
  phasesRemoved: string[];
  grandTotalFrom: number;
  grandTotalTo: number;
  grandTotalDelta: number;
}

export type QuotationMode = "FULL_HOUSE" | "PARTIAL" | "BUDGET";

export interface Boq {
  id?: number;
  boqNumber?: string;
  propertyName?: string;
  customer?: EntityRef;
  project?: EntityRef;
  measurement?: EntityRef;
  quotation?: EntityRef;
  lead?: EntityRef;
  siteVisit?: EntityRef;
  quotationMode?: QuotationMode;
  revisionNumber?: number;
  parentBoqId?: number;
  isLatestVersion?: boolean;
  status?: string;
  notes?: string;
  createdByUser?: EntityRef;
  approvedBy?: EntityRef;
  approvedDate?: string;
  rejectionReason?: string;
  revisionReason?: string;
  linkStatus?: "LINKED" | "UNLINKED_LEGACY";
  items?: BoqItem[];
  phases?: BoqPhase[];
  materialTotal?: number;
  labourTotal?: number;
  // Lump-sum overrides for the material/labour totals — null/undefined = auto-sum from line items.
  materialTotalOverride?: number | null;
  labourTotalOverride?: number | null;
  subtotal?: number;
  discountType?: "PERCENT" | "FLAT";
  discount?: number;
  discountAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  grandTotal?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoqActivityLogEntry {
  id?: number;
  actionType: string;
  description: string;
  performedBy: string;
  role?: string;
  actionTime: string;
}

export interface BoqDashboard {
  totalBoqs: number;
  draft: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  totalBoqValue: number;
  approvedQuotations: number;
  pendingQuotations: number;
  partialQuotations: number;
  revisionCount: number;
  approvedValue: number;
  pendingValue: number;
}

export interface BoqMeta {
  categories: string[];
  units: string[];
  statuses: string[];
  itemStatuses: string[];
  quotationModes: string[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface BoqFilters {
  status?: string;
  customerId?: number;
  projectId?: number;
  latestOnly?: boolean;
}

export const BOQ_CATEGORIES = [
  "Civil", "Carpentry", "Modular Kitchen", "Wardrobe", "False Ceiling", "Painting",
  "Electrical", "Plumbing", "Flooring", "Glass", "Hardware", "Furniture", "Others",
];

export const BOQ_UNITS = ["Sqft", "Sqm", "Rft", "Cum", "Nos", "Kg", "Ltr", "Set", "Lump Sum"];

export const BOQ_STATUSES = ["DRAFT", "REVIEW", "APPROVED", "REJECTED"];

export const BOQ_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const BOQ_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  REVIEW: "bg-violet-100 text-violet-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export const BOQ_ITEM_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  SELECTED: "bg-emerald-100 text-emerald-700",
  APPROVED: "bg-green-100 text-green-700",
  EXECUTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export const QUOTATION_MODE_LABELS: Record<string, string> = {
  FULL_HOUSE: "Complete House",
  PARTIAL: "Partial Selection",
  BUDGET: "Budget Mode",
};
