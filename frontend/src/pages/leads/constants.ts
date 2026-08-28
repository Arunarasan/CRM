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

// Who referred a lead when Lead Source = "Referral".
export const REFERRAL_TYPES = ["Existing Customer", "Employee", "Other"];

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
  Cold: "bg-emerald-100 text-emerald-700",
};

export const PRIORITY_STYLES: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-emerald-100 text-emerald-700",
  Low: "bg-slate-100 text-slate-600",
};

export const STATUS_STYLES: Record<string, string> = {
  "New": "bg-emerald-100 text-emerald-700",
  "Contacted": "bg-emerald-100 text-emerald-700",
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

export const STAGE_STYLES: Record<string, string> = {
  "New Lead": "bg-emerald-100 text-emerald-700",
  "First Contact": "bg-emerald-100 text-emerald-700",
  "Requirement Discussion": "bg-violet-100 text-violet-700",
  "Follow-up": "bg-purple-100 text-purple-700",
  "Site Visit": "bg-cyan-100 text-cyan-700",
  "Measurement": "bg-teal-100 text-teal-700",
  "Quotation": "bg-amber-100 text-amber-700",
  "Negotiation": "bg-orange-100 text-orange-700",
  "Approval": "bg-lime-100 text-lime-700",
  "Project": "bg-green-100 text-green-700",
};

export function stageStyle(stage?: string) {
  return STAGE_STYLES[stage || ""] || statusStyle(stage);
}

/** Two-letter initials from a display name, e.g. "Arun Kumar" -> "AK". */
export function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/** Deterministic soft avatar color from a name, so each owner keeps one hue. */
const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700", "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700",
  "bg-emerald-100 text-emerald-700", "bg-teal-100 text-teal-700",
];
export function avatarColor(name?: string) {
  if (!name) return "bg-muted text-muted-foreground";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Short human relative time, e.g. "Just now", "10 mins ago", "Yesterday", "2 days ago". */
export function relativeTime(value?: string | null) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(value);
}

/** Tone for a next-follow-up date: overdue (red), today (green), upcoming (muted). */
export function followUpTone(value?: string | null): { label: string; className: string } {
  if (!value) return { label: "—", className: "text-muted-foreground" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { label: "—", className: "text-muted-foreground" };
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfDate.getTime() - startOfToday.getTime()) / 86400000);
  if (dayDiff < 0) return { label: formatDate(value), className: "text-red-600 font-medium" };
  if (dayDiff === 0) return { label: "Today", className: "text-green-600 font-semibold" };
  if (dayDiff === 1) return { label: "Tomorrow", className: "text-emerald-600 font-medium" };
  return { label: formatDate(value), className: "text-foreground" };
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
  // Referral (captured at creation when leadSource === "Referral")
  referralType?: string; // "Existing Customer" | "Employee" | "Other"
  referredByCustomer?: { id: number; name?: string };
  referredByEmployee?: UserSummary;
  referrerName?: string;
  referrerContact?: string;
  referralNotes?: string;
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
  newLeads: number;
  contactedLeads: number;
  interestedLeads: number;
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
