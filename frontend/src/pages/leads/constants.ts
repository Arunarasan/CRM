// Central constants + types for the Lead Management module.
// Mirrors backend com.arudra.crm.util.LeadWorkflow.

export const LEAD_SOURCES = [
  "Walk-in", "Phone Call", "WhatsApp", "Website", "Facebook", "Instagram",
  "Google", "Referral", "Existing Customer", "Exhibition", "Email", "Other",
];

export const LEAD_TYPES = [
  "Residential", "Commercial", "Office", "Villa", "Apartment", "Modular Kitchen",
  "Wardrobe", "Renovation", "False Ceiling", "Wood Work", "Interior Decoration", "Other",
];

export const LEAD_STATUSES = [
  "New", "Contacted", "Follow-up", "Interested",
  "Site Visit Scheduled", "Site Visit Completed",
  "Measurement Scheduled", "Measurement Completed",
  "Quotation Preparing", "Quotation Sent", "Quotation Revised",
  "Quotation Approved", "Quotation Rejected",
  "Negotiation", "Project Confirmed", "Project Started",
  "On Hold", "Lost", "Cancelled", "Completed",
];

export const LEAD_STAGES = [
  "New Lead", "First Contact", "Requirement Discussion", "Follow-up",
  "Site Visit", "Measurement", "Quotation", "Negotiation", "Approval", "Project",
];

export const TEMPERATURES = ["Hot", "Warm", "Cold"];
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const TASK_TYPES = [
  "Call Customer", "Site Visit", "Measurement", "Design", "Quotation", "Reminder", "Meeting",
];

export const DOCUMENT_CATEGORIES = [
  "Property Images", "Reference Images", "Floor Plans", "Customer Documents",
  "Site Photos", "Videos", "Agreements", "Other",
];

export const COMMUNICATION_TYPES = [
  "Phone Call", "WhatsApp", "Email", "Meeting", "Office Visit", "Site Visit", "SMS", "Video Call",
];

export const CONSTRUCTION_STATUSES = [
  "Not Started", "Under Construction", "Structure Ready", "Plastering Done",
  "Flooring Done", "Ready to Move", "Occupied", "Renovation",
];

/** Kanban board: dropping a card into a column applies this status. */
export const BOARD_DROP_STATUS: Record<string, string> = {
  "New": "New",
  "Contacted": "Contacted",
  "Interested": "Interested",
  "Site Visit": "Site Visit Scheduled",
  "Measurement": "Measurement Scheduled",
  "Quotation": "Quotation Sent",
  "Negotiation": "Negotiation",
  "Won": "Project Confirmed",
  "On Hold": "On Hold",
  "Lost": "Lost",
};

export const TEMPERATURE_STYLES: Record<string, string> = {
  Hot: "bg-red-100 text-red-700",
  Warm: "bg-amber-100 text-amber-700",
  Cold: "bg-sky-100 text-sky-700",
};

export const PRIORITY_STYLES: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-blue-100 text-blue-700",
  Low: "bg-slate-100 text-slate-600",
};

export const STATUS_STYLES: Record<string, string> = {
  "New": "bg-blue-100 text-blue-700",
  "Contacted": "bg-indigo-100 text-indigo-700",
  "Follow-up": "bg-violet-100 text-violet-700",
  "Interested": "bg-purple-100 text-purple-700",
  "Site Visit Scheduled": "bg-cyan-100 text-cyan-700",
  "Site Visit Completed": "bg-cyan-100 text-cyan-800",
  "Measurement Scheduled": "bg-teal-100 text-teal-700",
  "Measurement Completed": "bg-teal-100 text-teal-800",
  "Quotation Preparing": "bg-amber-100 text-amber-700",
  "Quotation Sent": "bg-amber-100 text-amber-800",
  "Quotation Revised": "bg-yellow-100 text-yellow-800",
  "Quotation Approved": "bg-lime-100 text-lime-700",
  "Quotation Rejected": "bg-rose-100 text-rose-700",
  "Negotiation": "bg-orange-100 text-orange-700",
  "Project Confirmed": "bg-green-100 text-green-700",
  "Project Started": "bg-emerald-100 text-emerald-700",
  "On Hold": "bg-slate-100 text-slate-600",
  "Lost": "bg-red-100 text-red-700",
  "Cancelled": "bg-slate-200 text-slate-600",
  "Completed": "bg-green-100 text-green-800",
};

export function statusStyle(status?: string) {
  return STATUS_STYLES[status || ""] || "bg-muted text-muted-foreground";
}

export function formatINR(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return "₹" + Number(value).toLocaleString("en-IN");
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

export interface Lead {
  id: number;
  leadNumber: string;
  name: string;
  leadType?: string;
  leadSource?: string;
  priority?: string;
  status: string;
  stage?: string;
  leadTemperature?: string;
  companyName?: string;
  contactPerson?: string;
  mobileNumber: string;
  alternateMobile?: string;
  whatsappNumber?: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  googleMapLocation?: string;
  propertyType?: string;
  propertyName?: string;
  siteAddress?: string;
  landmark?: string;
  floorCount?: number;
  areaSqft?: number;
  expectedWorkArea?: number;
  currentConstructionStage?: string;
  requirementCategory?: string;
  projectDescription?: string;
  customerRequirements?: string;
  preferredDesignStyle?: string;
  preferredMaterial?: string;
  preferredColorTheme?: string;
  preferredCompletionDate?: string;
  estimatedDuration?: string;
  roomsRequired?: string;
  reqKitchen?: boolean;
  reqWardrobe?: boolean;
  reqTvUnit?: boolean;
  reqFalseCeiling?: boolean;
  reqPainting?: boolean;
  reqFlooring?: boolean;
  reqElectrical?: boolean;
  reqPlumbing?: boolean;
  reqWoodFinish?: boolean;
  specialRequests?: string;
  estimatedBudget?: number;
  minimumBudget?: number;
  maximumBudget?: number;
  expectedProjectValue?: number;
  paymentPreference?: string;
  expectedStartDate?: string;
  expectedEndDate?: string;
  quotationCreated?: boolean;
  quotationNumber?: string;
  quotationAmount?: number;
  quotationStatus?: string;
  assignedSalesExecutive?: UserSummary;
  assignedDesigner?: UserSummary;
  assignedEngineer?: UserSummary;
  projectManager?: UserSummary;
  nextFollowUpDate?: string;
  nextFollowUpTime?: string;
  lastFollowUp?: string;
  lastContactAt?: string;
  followUpCount?: number;
  isConverted: boolean;
  convertedToCustomer?: { id: number; name?: string };
  convertedToProject?: { id: number; projectName?: string };
  convertedDate?: string;
  lostReason?: string;
  competitor?: string;
  customerFeedback?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface LeadCard {
  id: number;
  leadNumber: string;
  name: string;
  companyName?: string;
  mobileNumber?: string;
  city?: string;
  leadSource?: string;
  leadType?: string;
  status: string;
  stage?: string;
  priority?: string;
  leadTemperature?: string;
  estimatedBudget?: number;
  nextFollowUpDate?: string;
  lastContactAt?: string;
  createdAt?: string;
  assignedToId?: number;
  assignedToName?: string;
  isConverted?: boolean;
}

export interface BoardColumn {
  key: string;
  count: number;
  totalValue: number;
  leads: LeadCard[];
}

export interface DashboardMetrics {
  totalLeads: number;
  todayLeads: number;
  weekLeads: number;
  monthLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  convertedLeads: number;
  lostLeads: number;
  pendingFollowups: number;
  todaysFollowups: number;
  todaySiteVisits: number;
  todayMeasurements: number;
  quotationPending: number;
  conversionRate: string;
}

export interface LeadFilters {
  status: string;
  stage: string;
  source: string;
  leadType: string;
  priority: string;
  temperature: string;
  assignedEmployeeId: string;
  isConverted: string;
  budgetMin: string;
  budgetMax: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: LeadFilters = {
  status: "", stage: "", source: "", leadType: "", priority: "", temperature: "",
  assignedEmployeeId: "", isConverted: "", budgetMin: "", budgetMax: "", dateFrom: "", dateTo: "",
};
