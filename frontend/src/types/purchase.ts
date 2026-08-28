// Central types for the Enterprise Purchase Management module.
// Mirrors backend com.arudra.crm.entity.{Supplier,PurchaseRequest(+Item/Approval),PurchaseOrder(+Item),
// GoodsReceiptNote(+Item/Photo),PurchaseBill,PurchasePayment,PurchaseReturn(+Item)}.

import type { EntityRef, Product, Warehouse } from "./inventory";

export interface Supplier {
  id: number;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  taxId?: string;
  gstin?: string;
  pan?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  creditLimit?: number;
  paymentTerms?: string;
  leadTimeDays?: number;
  performanceRating?: number;
  status?: "ACTIVE" | "INACTIVE";
}

export interface SupplierProfile {
  supplier: Supplier;
  totalOrders: number;
  totalOrderedValue: number;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  creditLimit?: number;
  onTimeDeliveryPercent?: number | null;
  completedOrders: number;
  pastPurchases: PurchaseOrder[];
  recentPayments: PurchasePayment[];
}

export type PurchaseRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CONVERTED";
export type PrPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface PurchaseRequestItem {
  id?: number;
  product: Product;
  quantity: number;
  estimatedUnitPrice?: number;
  notes?: string;
}

export interface PurchaseRequestApproval {
  id: number;
  level: number;
  approver?: EntityRef | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  comments?: string;
  actedAt?: string;
}

export interface PurchaseRequest {
  id: number;
  requestNumber: string;
  product?: Product | null;
  warehouse?: Warehouse | null;
  supplier?: EntityRef | null;
  quantity?: number | null;
  reorderLevelSnapshot?: number;
  project?: { id: number; projectName?: string } | null;
  boq?: { id: number; title?: string } | null;
  requestedBy?: EntityRef | null;
  priority: PrPriority;
  requiredDate?: string;
  reason?: string;
  source: string;
  status: PurchaseRequestStatus;
  triggeredBy: "SYSTEM" | "MANUAL";
  approvalLevels: number;
  currentLevel: number;
  approvedBy?: EntityRef | null;
  decidedAt?: string;
  notes?: string;
  items: PurchaseRequestItem[];
  approvals: PurchaseRequestApproval[];
  createdAt?: string;
}

export type PurchaseOrderStatus =
  | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  | "SENT" | "CONFIRMED" | "PARTIAL" | "COMPLETED" | "CANCELLED";

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplier: Supplier;
  date: string;
  expectedDeliveryDate?: string;
  status: PurchaseOrderStatus;
  warehouse?: Warehouse | null;
  project?: { id: number; projectName?: string } | null;
  boq?: { id: number; title?: string } | null;
  phase?: { id: number; name?: string } | null;
  room?: { id: number; name?: string } | null;
  task?: { id: number; taskName?: string } | null;
  purchaseRequest?: { id: number; requestNumber?: string } | null;
  deliveryAddress?: string;
  paymentTerms?: string;
  subtotal?: number;
  taxPercent?: number;
  taxAmount?: number;
  discountAmount?: number;
  transportationCost?: number;
  totalAmount: number;
  sentAt?: string;
  confirmedAt?: string;
  notes?: string;
  createdAt?: string;
}

export interface PurchaseOrderItem {
  id: number;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;
  returnedQuantity: number;
}

export type QcStatus = "PENDING" | "PASS" | "PARTIAL_PASS" | "REJECT";

export interface GoodsReceiptNote {
  id: number;
  grnNumber: string;
  purchaseOrder?: { id: number; poNumber?: string; status?: string } | null;
  date: string;
  receivedBy?: string;
  receivedByUser?: EntityRef | null;
  warehouse: Warehouse;
  supplierInvoiceNumber?: string;
  vehicleNumber?: string;
  status: "DRAFT" | "APPROVED";
  qcStatus: QcStatus;
  qcReason?: string;
  qcRemarks?: string;
  notes?: string;
  photos?: GrnPhoto[];
}

export interface GoodsReceiptNoteItem {
  id: number;
  product: Product;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  damagedQuantity: number;
  qcStatus?: string;
  remarks?: string;
}

export interface GrnPhoto {
  id: number;
  photoUrl: string;
  caption?: string;
}

export interface PurchaseBill {
  id: number;
  billNumber: string;
  purchaseOrder?: { id: number; poNumber?: string } | null;
  supplier: Supplier;
  date: string;
  dueDate?: string;
  taxAmount?: number;
  totalAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  notes?: string;
}

export type PaymentType = "ADVANCE" | "PARTIAL" | "FULL";

export interface PurchasePayment {
  id: number;
  purchaseBill?: { id: number; billNumber?: string } | null;
  purchaseOrder?: { id: number; poNumber?: string } | null;
  supplier?: Supplier | null;
  amount: number;
  paymentType: PaymentType;
  paymentDate: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
}

export type ReturnReason = "DAMAGED" | "WRONG_MATERIAL" | "EXCESS_QUANTITY";

export interface PurchaseReturnItem {
  id?: number;
  product: Product;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
}

export interface PurchaseReturn {
  id: number;
  returnNumber: string;
  purchaseOrder?: { id: number; poNumber?: string } | null;
  grn?: { id: number; grnNumber?: string } | null;
  supplier: Supplier;
  warehouse: Warehouse;
  reasonType: ReturnReason;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  totalAmount?: number;
  notes?: string;
  confirmedAt?: string;
  createdAt?: string;
  items?: PurchaseReturnItem[];
}

export interface PurchaseDashboard {
  pendingPurchaseRequests: number;
  approvedPurchaseRequests: number;
  pendingPurchaseOrders: number;
  openPurchaseOrders: number;
  pendingGrns: number;
  pendingBills: number;
  outstandingPayments: number;
  todaysDeliveries: PurchaseOrder[];
  delayedDeliveries: PurchaseOrder[];
  lowStockMaterials: number;
}

export interface PriceComparisonRow {
  supplierId: number;
  supplierName: string;
  price?: number;
  leadTimeDays?: number;
  rating?: number;
  isPreferred?: boolean;
  lastPurchaseDate?: string;
  lastPurchasePrice?: number;
  averagePrice?: number;
}

export const PO_STATUSES: PurchaseOrderStatus[] = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SENT", "CONFIRMED", "PARTIAL", "COMPLETED", "CANCELLED",
];

export const PO_STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  SENT: "bg-emerald-100 text-emerald-700",
  CONFIRMED: "bg-cyan-100 text-cyan-700",
  PARTIAL: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export const PR_STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
};

export const PRIORITY_TONE: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-emerald-100 text-emerald-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};
