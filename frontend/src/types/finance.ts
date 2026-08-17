// Central types for the Enterprise Billing & Finance module.
// Mirrors backend com.arudra.crm.entity.{Invoice,InvoiceItem,CustomerPayment,CreditDebitNote,
// Refund,PaymentSchedule,CustomerLedgerEntry,ProjectExpense} plus the report/dashboard maps.

export interface FinRef {
  id: number;
  name?: string;
  projectName?: string;
  quotationNumber?: string;
  phone?: string;
  [key: string]: unknown;
}

export type InvoiceStatus = "DRAFT" | "GENERATED" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
export type InvoiceType = "QUOTATION" | "ADVANCE" | "PROGRESS" | "FINAL" | "PROFORMA";
export type PaymentStatus = "PENDING_APPROVAL" | "CONFIRMED" | "REJECTED";
export type RefundStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export const PAYMENT_STAGES = [
  "QUOTATION_ADVANCE", "DESIGN_APPROVAL", "MATERIAL_PURCHASE", "WORK_STARTED",
  "COMPLETION_50", "COMPLETION_75", "PROJECT_COMPLETION", "FINAL_SETTLEMENT",
] as const;

export const PAYMENT_METHODS = [
  "CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CREDIT_CARD", "DEBIT_CARD", "NEFT", "RTGS", "IMPS",
] as const;

export const EXPENSE_CATEGORIES = [
  "MATERIAL", "LABOUR", "CONTRACTOR", "TRANSPORT", "EQUIPMENT", "OVERHEAD", "MISC",
] as const;

export interface InvoiceItem {
  id?: number;
  description: string;
  hsnCode?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  gstRate?: number;
  totalPrice?: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  customer: FinRef;
  project?: FinRef | null;
  quotation?: FinRef | null;
  boq?: FinRef | null;
  paymentSchedule?: FinRef | null;
  paymentStage?: string;
  date: string;
  dueDate?: string;
  subTotal: number;
  discountType?: "PERCENTAGE" | "FLAT";
  discountValue?: number;
  discountAmount: number;
  gstType: "CGST_SGST" | "IGST";
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  roundOff: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  retentionPercent?: number;
  retentionAmount: number;
  placeOfSupply?: string;
  status: InvoiceStatus;
  sentAt?: string;
  cancelledReason?: string;
  notes?: string;
  terms?: string;
  createdAt?: string;
}

export interface CustomerPayment {
  id: number;
  paymentNumber: string;
  customer: FinRef;
  invoice?: Invoice | null;
  project?: FinRef | null;
  amount: number;
  paymentType: "ADVANCE" | "STAGE" | "MILESTONE" | "PARTIAL" | "FULL" | "RETENTION";
  paymentStage?: string;
  status: PaymentStatus;
  paymentDate: string;
  paymentMethod?: string;
  referenceNumber?: string;
  collectedBy?: FinRef | null;
  proofUrl?: string;
  remarks?: string;
}

export interface CreditDebitNote {
  id: number;
  noteNumber: string;
  type: "CREDIT" | "DEBIT";
  customer: FinRef;
  invoice?: Invoice | null;
  project?: FinRef | null;
  amount: number;
  date: string;
  status: "ACTIVE" | "CANCELLED";
  reason?: string;
}

export interface Refund {
  id: number;
  refundNumber: string;
  customer: FinRef;
  invoice?: Invoice | null;
  project?: FinRef | null;
  amount: number;
  reason?: string;
  status: RefundStatus;
  requestedBy?: FinRef | null;
  approvedBy?: FinRef | null;
  decidedAt?: string;
  refundDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
}

export interface PaymentSchedule {
  id: number;
  project: FinRef;
  stage: string;
  description?: string;
  percentage?: number;
  /** Work-progress % at/above which this stage auto-bills; null = not progress-driven. */
  triggerPercentage?: number | null;
  autoTriggered?: boolean;
  autoTriggeredDate?: string | null;
  amount: number;
  dueDate?: string;
  status: "PENDING" | "INVOICED" | "PARTIAL" | "PAID" | "OVERDUE";
  invoice?: Invoice | null;
  sortOrder: number;
}

/** Combined completion tracker (work % + payment %) with per-milestone state. */
export interface BillingProgress {
  projectId: number;
  projectName: string;
  projectStatus: string;
  workPercent: number;
  paymentPercent: number;
  autoBillingEnabled: boolean;
  scheduledTotal: number;
  invoicedTotal: number;
  collectedTotal: number;
  hasSchedule: boolean;
  fullySettled: boolean;
  stages: BillingStage[];
}

export interface BillingStage {
  id: number;
  stage: string;
  description?: string | null;
  percentage?: number | null;
  triggerPercentage?: number | null;
  amount: number;
  status: PaymentSchedule["status"];
  autoTriggered: boolean;
  reached: boolean;
  progressDriven: boolean;
  invoice?: {
    id: number;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
  } | null;
}

export interface ProjectExpense {
  id: number;
  project: FinRef;
  category: string;
  source: string;
  referenceType?: string;
  referenceId?: number;
  description?: string;
  amount: number;
  expenseDate: string;
  vendor?: string;
  paymentMethod?: string;
  recordedBy?: FinRef | null;
  notes?: string;
}

export interface LedgerRow {
  id: number;
  date: string;
  type: string;
  referenceType?: string;
  referenceId?: number;
  referenceNumber?: string;
  description?: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface CustomerLedger {
  customerId: number;
  customerName: string;
  openingBalance: number;
  entries: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export interface CustomerOutstanding {
  customerId: number;
  customerName: string;
  phone?: string;
  totalOutstanding: number;
  overdueAmount: number;
  upcomingDue?: number;
  openInvoices?: number;
  lastPaymentDate?: string | null;
  creditLimit?: number | null;
  openingBalance?: number;
}

export interface ProjectProfitability {
  projectId: number;
  projectName: string;
  projectStatus?: string;
  customerName?: string;
  quotationValue: number;
  budget?: number;
  estimatedCost?: number;
  revenue: number;
  collected: number;
  outstanding: number;
  materialCost: number;
  labourCost: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  profitPercent: number;
}

export interface MonthBucket {
  month: string;
  [key: string]: number | string;
}

export interface FinanceDashboard {
  todaysCollection: number;
  monthCollection: number;
  monthRevenue: number;
  totalOutstanding: number;
  overdueAmount: number;
  pendingInvoices: number;
  monthExpenses: number;
  monthProfit: number;
  upcomingDues: {
    invoiceId: number; invoiceNumber: string; customerName: string; dueDate: string; balanceDue: number;
  }[];
  pendingApprovalPayments: number;
  cashFlow: MonthBucket[];
  recentPayments: CustomerPayment[];
  recentInvoices: Invoice[];
}

export interface PageResp<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number?: number;
}
