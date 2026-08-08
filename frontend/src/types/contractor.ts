// Central types for the Enterprise Contractor Management module.
// Mirrors backend com.arudra.crm.entity.{Contractor,ContractorWorkPackage,WorkPackageItem,
// WorkPackageAssignment,ContractorMaterialIssue(+Item),ContractorDailyProgress,
// ContractorQualityInspection,WorkPackageChange,ContractorBill(+Item/Approval),
// ContractorPayment,ContractorLedgerEntry,ContractorAttendance,ContractorSafetyRecord,ContractorDocument}.

import type { EntityRef, Product, Warehouse } from "./inventory";

export const TRADES = [
  "CARPENTRY", "ALUMINIUM", "GLASS", "PAINTING", "ELECTRICAL", "PLUMBING",
  "FALSE_CEILING", "FABRICATION", "CIVIL", "TILES", "FURNITURE", "HVAC", "CLEANING",
] as const;
export type Trade = (typeof TRADES)[number];

export const CONTRACTOR_TYPES = [
  "CARPENTER", "ELECTRICIAN", "PLUMBER", "PAINTER", "FABRICATOR", "GLASS_INSTALLER",
  "TILE_LAYER", "CIVIL_CONTRACTOR", "INTERIOR_CONTRACTOR", "MODULAR_KITCHEN_VENDOR",
  "HVAC_CONTRACTOR", "CLEANING_CONTRACTOR",
] as const;
export type ContractorType = (typeof CONTRACTOR_TYPES)[number];

export const RATE_TYPES = [
  "PER_DAY", "PER_SQFT", "PER_RUNNING_FEET", "PER_UNIT", "FIXED_CONTRACT", "MILESTONE_BASED",
] as const;
export type RateType = (typeof RATE_TYPES)[number];

export const RATE_TYPE_LABEL: Record<string, string> = {
  PER_DAY: "Per day",
  PER_SQFT: "Per sqft",
  PER_RUNNING_FEET: "Per running foot",
  PER_UNIT: "Per unit",
  FIXED_CONTRACT: "Fixed contract",
  MILESTONE_BASED: "Milestone based",
};

export type ContractorStatus = "ACTIVE" | "INACTIVE" | "BLACKLISTED" | "PENDING_APPROVAL";

export interface Contractor {
  id: number;
  contractorCode?: string;
  name: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  companyName?: string;
  ownerName?: string;
  contactPerson?: string;
  skills?: string;
  trade?: Trade | string;
  trades?: string;
  contractorType?: ContractorType | string;
  gstin?: string;
  pan?: string;
  pfNumber?: string;
  esiNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  upiId?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  hourlyRate?: number;
  dailyRate?: number;
  creditDays?: number;
  openingBalance?: number;
  retentionPercentage?: number;
  tdsPercentage?: number;
  performanceRating?: number;
  ratingQuality?: number;
  ratingTimeliness?: number;
  ratingSafety?: number;
  overallRating?: number;
  totalWorkPackages?: number;
  completedWorkPackages?: number;
  status: ContractorStatus;
  agreementNumber?: string;
  agreementStartDate?: string;
  agreementEndDate?: string;
  insuranceNumber?: string;
  insuranceExpiryDate?: string;
  licenseNumber?: string;
  licenseExpiryDate?: string;
  user?: EntityRef | null;
  notes?: string;
}

export type WorkPackageStatus =
  | "DRAFT" | "PENDING_ASSIGNMENT" | "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "ON_HOLD"
  | "WORK_COMPLETED" | "INSPECTION_PENDING" | "REWORK" | "COMPLETED" | "CANCELLED";

export interface ProjectRef { id: number; projectName?: string; projectCode?: string; status?: string }
export interface PhaseRef { id: number; name?: string; sequence?: number }
export interface RoomRef { id: number; roomName?: string; floorName?: string }

export interface ContractorWorkPackage {
  id: number;
  packageCode?: string;
  packageName: string;
  description?: string;
  project: ProjectRef;
  phase?: PhaseRef | null;
  room?: RoomRef | null;
  boq?: { id: number; boqNumber?: string } | null;
  trade?: Trade | string;
  status: WorkPackageStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  rateType: RateType | string;
  rate?: number;
  quantity?: number;
  unit?: string;
  estimatedCost: number;
  approvedCost: number;
  actualCost: number;
  billedAmount: number;
  paidAmount: number;
  outstandingAmount?: number;
  delayed?: boolean;
  retentionPercentage?: number;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  completionPercentage: number;
  qualityStatus?: string | null;
  siteEngineer?: EntityRef | null;
  scopeOfWork?: string;
  terms?: string;
  remarks?: string;
}

export interface WorkPackageItem {
  id: number;
  boqItem?: { id: number; itemName?: string; category?: string } | null;
  projectRoomItem?: { id: number; itemName?: string } | null;
  task?: { id: number; taskName?: string; status?: string } | null;
  itemName: string;
  description?: string;
  unit?: string;
  quantity: number;
  completedQuantity: number;
  rate?: number;
  amount: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  remarks?: string;
}

export type AssignmentStatus =
  | "ASSIGNED" | "ACCEPTED" | "REJECTED" | "IN_PROGRESS" | "COMPLETED" | "TERMINATED";

export interface WorkPackageAssignment {
  id: number;
  workPackage?: { id: number; packageCode?: string; packageName?: string };
  contractor: Contractor;
  status: AssignmentStatus;
  role?: string;
  scopeShare?: number;
  rateType?: string;
  rate?: number;
  agreedAmount: number;
  startDate?: string;
  endDate?: string;
  assignedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  completedAt?: string;
  assignedBy?: EntityRef | null;
  remarks?: string;
}

export type MaterialIssueStatus =
  | "DRAFT" | "ISSUED" | "PARTIALLY_RETURNED" | "RECONCILED" | "CANCELLED";

export interface ContractorMaterialIssueItem {
  id: number;
  product: Product;
  unit?: string;
  issuedQuantity: number;
  returnedQuantity: number;
  consumedQuantity: number;
  wasteQuantity: number;
  damagedQuantity: number;
  unitRate: number;
  totalValue: number;
  recoverableValue: number;
  unreconciledQuantity?: number;
  remarks?: string;
}

export interface ContractorMaterialIssue {
  id: number;
  issueNumber?: string;
  workPackage: { id: number; packageCode?: string; packageName?: string };
  contractor: Contractor;
  project: ProjectRef;
  warehouse?: Warehouse | null;
  issueDate: string;
  status: MaterialIssueStatus;
  issuedBy?: EntityRef | null;
  receivedBy?: string;
  totalValue: number;
  recoverableValue: number;
  remarks?: string;
}

export interface ContractorProgressMedia {
  id?: number;
  mediaType?: "PHOTO" | "VIDEO" | "DOCUMENT";
  fileUrl: string;
  fileName?: string;
  caption?: string;
}

export interface ContractorDailyProgress {
  id: number;
  workPackage: { id: number; packageCode?: string; packageName?: string };
  contractor: Contractor;
  project: ProjectRef;
  progressDate: string;
  workDone?: string;
  completionPercentage: number;
  quantityCompleted?: number;
  unit?: string;
  workersCount?: number;
  supervisorName?: string;
  issues?: string;
  remarks?: string;
  weather?: string;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED";
  reportedBy?: EntityRef | null;
  verifiedBy?: EntityRef | null;
  verifiedAt?: string;
}

export type InspectionResult = "PENDING" | "PASS" | "FAIL" | "REWORK" | "APPROVED";

export interface ContractorQualityInspection {
  id: number;
  inspectionNumber?: string;
  workPackage: { id: number; packageCode?: string; packageName?: string };
  contractor: Contractor;
  project: ProjectRef;
  inspectionDate: string;
  inspectionType?: string;
  result: InspectionResult;
  score?: number;
  checklist?: string;
  observations?: string;
  defects?: string;
  correctiveAction?: string;
  reworkDueDate?: string;
  inspectedBy?: EntityRef | null;
  approvedBy?: EntityRef | null;
  approvedAt?: string;
  comments?: string;
}

export interface WorkPackageChange {
  id: number;
  changeNumber?: string;
  workPackage?: { id: number; packageCode?: string };
  projectChangeRequestId?: number | null;
  changeType: "ADDITIONAL_WORK" | "REDUCED_SCOPE" | "RATE_REVISION" | "TIME_EXTENSION";
  description?: string;
  reason?: string;
  costImpact: number;
  quantityImpact?: number;
  daysExtension?: number;
  revisedEndDate?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy?: EntityRef | null;
  approvedBy?: EntityRef | null;
  approvedAt?: string;
  rejectionReason?: string;
}

export type BillStatus =
  | "DRAFT" | "SUBMITTED" | "ENGINEER_APPROVED" | "PM_APPROVED" | "FINANCE_APPROVED"
  | "PARTIALLY_PAID" | "PAID" | "REJECTED" | "CANCELLED";

export interface ContractorBillItem {
  id?: number;
  workPackageItem?: { id: number } | null;
  description: string;
  unit?: string;
  quantity: number;
  previouslyBilledQuantity?: number;
  rate: number;
  amount: number;
  measurementDetails?: string;
}

export interface ContractorBillApproval {
  id: number;
  stage: "SITE_ENGINEER" | "PROJECT_MANAGER" | "FINANCE";
  sequence: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approver?: EntityRef | null;
  actedAt?: string;
  approvedAmount?: number;
  comments?: string;
}

export interface ContractorBill {
  id: number;
  billNumber?: string;
  contractor: Contractor;
  workPackage?: { id: number; packageCode?: string; packageName?: string } | null;
  project: ProjectRef;
  billType: "ADVANCE" | "RUNNING" | "FINAL";
  billDate: string;
  periodFrom?: string;
  periodTo?: string;
  contractorInvoiceNumber?: string;
  workCompletedPercentage?: number;
  grossAmount: number;
  materialDeduction: number;
  advanceAdjustment: number;
  penaltyAmount: number;
  otherDeduction: number;
  retentionPercentage?: number;
  retentionAmount: number;
  taxableAmount: number;
  gstPercentage?: number;
  gstAmount: number;
  tdsPercentage?: number;
  tdsAmount: number;
  netAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: BillStatus;
  currentApprovalStage?: string | null;
  submittedBy?: EntityRef | null;
  submittedAt?: string;
  measurementNotes?: string;
  remarks?: string;
  attachmentUrl?: string;
}

/** Shape returned by GET /contractor-bills/prepare — a draft, nothing persisted yet. */
export interface PreparedBill {
  workPackageId: number;
  workPackageCode?: string;
  contractorId: number;
  contractorName: string;
  projectId: number;
  billType: string;
  workCompletedPercentage?: number;
  items: {
    workPackageItemId?: number;
    description: string;
    unit?: string;
    quantity: number;
    previouslyBilledQuantity?: number;
    rate?: number;
    amount: number;
  }[];
  grossAmount: number;
  materialDeduction: number;
  advanceAdjustment: number;
  unadjustedAdvance: number;
  retentionPercentage?: number;
  gstPercentage?: number;
  tdsPercentage?: number;
}

export interface ContractorPayment {
  id: number;
  contractor: Contractor;
  project?: ProjectRef | null;
  bill?: { id: number; billNumber?: string } | null;
  workPackage?: { id: number; packageCode?: string } | null;
  amount: number;
  paymentDate?: string;
  status: "PENDING" | "PAID" | "OVERDUE";
  paymentType: "ADVANCE" | "RUNNING_BILL" | "FINAL_BILL" | "RETENTION_RELEASE";
  paymentMode?: string;
  referenceNumber?: string;
  transactionReference?: string;
  tdsAmount?: number;
  invoiceUrl?: string;
  remarks?: string;
}

export interface ContractorLedgerRow {
  id: number;
  entryDate: string;
  entryType: string;
  referenceType?: string;
  referenceId?: number;
  referenceNumber?: string;
  description?: string;
  debit: number;
  credit: number;
  balance: number;
  projectName?: string | null;
}

export interface ContractorLedger {
  contractorId: number;
  contractorName: string;
  openingBalance: number;
  entries: ContractorLedgerRow[];
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
}

export interface ContractorAttendance {
  id: number;
  contractor: Contractor;
  workPackage?: { id: number; packageCode?: string } | null;
  project?: ProjectRef | null;
  date: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY";
  hoursWorked?: number;
  workersCount?: number;
  skilledCount?: number;
  unskilledCount?: number;
  supervisorName?: string;
  inTime?: string;
  outTime?: string;
  remarks?: string;
}

export interface ContractorSafetyRecord {
  id: number;
  contractor: Contractor;
  workPackage?: { id: number; packageCode?: string } | null;
  project?: ProjectRef | null;
  recordDate: string;
  recordType: "PPE_CHECK" | "SAFETY_CHECKLIST" | "INCIDENT" | "VIOLATION";
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  ppeCompliant: boolean;
  checklist?: string;
  description?: string;
  actionTaken?: string;
  penaltyAmount: number;
  photoUrl?: string;
  status: "OPEN" | "CLOSED";
}

export interface ContractorDocument {
  id: number;
  fileName: string;
  fileUrl: string;
  type: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  verified: boolean;
  verifiedBy?: EntityRef | null;
  verifiedAt?: string;
  expired?: boolean;
  remarks?: string;
}

export interface ContractorOutstanding {
  billedOutstanding: number;
  retentionHeld: number;
  totalPaid: number;
  advancesPaid?: number;
  ledgerBalance: number;
}

export interface ContractorPerformance {
  contractorId: number;
  contractorName: string;
  trade?: string;
  totalPackages: number;
  completedPackages: number;
  inProgressPackages: number;
  delayedPackages: number;
  onTimeDeliveryPercent: number;
  qualityRating?: number;
  timelinessRating?: number;
  safetyRating?: number;
  overallRating?: number;
  safetyIncidents: number;
  safetyViolations: number;
  materialIssuedValue: number;
  totalBilled: number;
  totalPaid: number;
}

export interface ContractorDetail {
  contractor: Contractor;
  projects: unknown[];
  workPackages: ContractorWorkPackage[];
  assignments: WorkPackageAssignment[];
  attendance: ContractorAttendance[];
  bills: ContractorBill[];
  payments: ContractorPayment[];
  documents: ContractorDocument[];
  safety: ContractorSafetyRecord[];
  outstanding: ContractorOutstanding;
  performance: ContractorPerformance;
}

export interface WorkPackageDetail {
  workPackage: ContractorWorkPackage;
  items: WorkPackageItem[];
  assignments: WorkPackageAssignment[];
  progress: ContractorDailyProgress[];
  bills: ContractorBill[];
  changes: WorkPackageChange[];
}

export interface BillDetail {
  bill: ContractorBill;
  items: ContractorBillItem[];
  approvals: ContractorBillApproval[];
  payments: ContractorPayment[];
}

export interface ContractorDashboard {
  totalContractors: number;
  activeContractors: number;
  engagedContractors: number;
  totalWorkPackages: number;
  activeWorkPackages: number;
  completedWorkPackages: number;
  delayedWorkPackages: number;
  pendingBills: number;
  pendingBillValue: number;
  pendingPayments: number;
  pendingPaymentValue: number;
  retentionHeld: number;
  todaysProgressReports: number;
  workersOnSiteToday: number;
  openQualityIssues: number;
  statusBreakdown: Record<string, number>;
  tradeBreakdown: Record<string, number>;
}

export interface GenerateFromBoqResult {
  packagesCreated: number;
  packagesUpdated: number;
  itemsLinked: number;
  itemsSkipped: number;
  boqItemsConsidered: number;
}

// --- Display tones -----------------------------------------------------------

export const WP_STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_ASSIGNMENT: "bg-amber-100 text-amber-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-700",
  ON_HOLD: "bg-orange-100 text-orange-700",
  WORK_COMPLETED: "bg-teal-100 text-teal-700",
  INSPECTION_PENDING: "bg-violet-100 text-violet-700",
  REWORK: "bg-rose-100 text-rose-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export const BILL_STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  ENGINEER_APPROVED: "bg-blue-100 text-blue-700",
  PM_APPROVED: "bg-indigo-100 text-indigo-700",
  FINANCE_APPROVED: "bg-teal-100 text-teal-700",
  PARTIALLY_PAID: "bg-cyan-100 text-cyan-700",
  PAID: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export const CONTRACTOR_STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-slate-200 text-slate-600",
  BLACKLISTED: "bg-rose-100 text-rose-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
};

export const QC_RESULT_TONE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  PASS: "bg-emerald-100 text-emerald-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  FAIL: "bg-rose-100 text-rose-700",
  REWORK: "bg-orange-100 text-orange-700",
};
