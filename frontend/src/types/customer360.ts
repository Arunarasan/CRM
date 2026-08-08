// Mirrors the backend DTOs in com.arudra.crm.dto.customer360.*

export interface CustomerOverview {
  id: number;
  photoUrl?: string | null;
  name: string;
  customerCode?: string;
  customerType?: string;
  status?: string;
  companyName?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  assignedEmployeeId?: number;
  assignedEmployeeName?: string;
  createdAt?: string;
  customerSince?: string;
  updatedAt?: string;
  healthScore?: number;
  rating?: number;
  leadScore?: number | null;
  probabilityToConvert?: number | null;
  outstandingBalance?: number;
  nextFollowUpDate?: string | null;
  nextFollowUpPurpose?: string | null;
  lastCommunicationDate?: string | null;
  lastCommunicationChannel?: string | null;
  assignedSalesPersonName?: string;
  assignedProjectManagerName?: string;
  customerLifetimeValue?: number;
}

export interface CustomerDashboardStats {
  totalLeads: number;
  openLeads: number;
  wonLeads: number;
  lostLeads: number;
  siteVisits: number;
  measurements: number;
  quotations: number;
  approvedQuotations: number;
  rejectedQuotations: number;
  projects: number;
  completedProjects: number;
  runningProjects: number;
  tasks: number;
  completedTasks: number;
  pendingTasks: number;
  invoices: number;
  paidAmount: number;
  pendingAmount: number;
  outstandingBalance: number;
  documents: number;
  followUps: number;
  lastCommunication?: string | null;
  nextFollowUp?: string | null;
  customerLifetimeValue: number;
}

export interface CustomerDocumentUnified {
  id: number;
  sourceType: "CUSTOMER" | "PROJECT" | "QUOTATION" | "LEAD";
  sourceId: number;
  sourceLabel?: string;
  fileName: string;
  fileUrl?: string;
  documentType?: string;
  documentVersion?: number;
  uploadedByName?: string;
  uploadedAt?: string;
}

export type FollowUpBucket = "TODAY" | "UPCOMING" | "OVERDUE" | "COMPLETED" | "CANCELLED";

export interface CustomerFollowUp {
  id: number;
  assignedEmployeeId?: number;
  assignedEmployeeName?: string;
  purpose?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  followupDate: string;
  followupTime?: string;
  method?: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  notes?: string;
  completionNotes?: string;
  nextFollowupDate?: string;
  bucket: FollowUpBucket;
}

export interface CustomerActivityLogEntry {
  id: number;
  action: string;
  description?: string;
  performedBy?: string;
  performedRole?: string;
  performedAt?: string;
  ipAddress?: string;
}

export interface CustomerFinancialSummary {
  totalInvoiced: number;
  totalPaid: number;
  advancePaid: number;
  outstandingBalance: number;
  creditLimit?: number;
  paymentTerms?: string;
  lastPaymentDate?: string;
  invoiceCount: number;
  paymentCount: number;
}

export interface CustomerProjectSummary {
  totalProjects: number;
  runningProjects: number;
  completedProjects: number;
  cancelledProjects: number;
  totalBudget: number;
  totalSpent: number;
  lastProjectDate?: string;
}

export interface CustomerCommunicationSummary {
  totalInteractions: number;
  calls: number;
  whatsappMessages: number;
  emails: number;
  meetings: number;
  siteVisitDiscussions: number;
  lastCommunicationDate?: string;
  lastCommunicationChannel?: string;
  lastCommunicationOutcome?: string;
}

export interface CustomerActivity {
  id: number;
  action: string;
  description?: string;
  performedByName?: string;
  createdAt?: string;
  channel?: string;
  customerMood?: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  outcome?: string;
  customerResponse?: string;
  attachmentUrl?: string;
  attachmentFileName?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // current page, 0-indexed
  size: number;
}
