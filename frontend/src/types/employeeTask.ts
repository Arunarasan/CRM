// Central types for the mobile Employee Task & Work Execution module.
// Mirrors backend com.arudra.crm.service.EmployeeTaskService's compact Map responses —
// intentionally loose (mostly optional fields) since the backend returns hand-built Maps, not DTOs.

export type TaskStatus =
  | 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'PAUSED' | 'WAITING_MATERIAL'
  | 'WAITING_APPROVAL' | 'COMPLETED' | 'REJECTED' | 'REWORK' | 'CANCELLED';

export type AssignmentStatus =
  | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'PAUSED' | 'WAITING_MATERIAL'
  | 'COMPLETED' | 'REJECTED' | 'REWORK' | 'CANCELLED';

export type IssueType =
  | 'MATERIAL_SHORTAGE' | 'CUSTOMER_CHANGE' | 'MEASUREMENT_ISSUE'
  | 'SITE_ISSUE' | 'DELAY' | 'SAFETY_ISSUE';

export type MediaType = 'PHOTO' | 'VIDEO' | 'VOICE';

export type DueState = 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE';

export interface TaskCard {
  id: number;
  taskName: string;
  project: { id: number; name: string } | null;
  room: string | null;
  floor: string | null;
  itemName: string | null;
  priority: string;
  status: TaskStatus;
  dueDate: string | null;
  dueState?: DueState;
  progressPercent: number | null;
  assignedEmployees: string[];
  myAssignmentStatus?: AssignmentStatus;
  canPick?: boolean; // set on pool cards — false when the viewer is at capacity
  dataEntry?: boolean; // quick data-entry lead task — exempt from the capacity cap
  holdExpiresAt?: string | null; // ISO time this held data-entry task auto-releases (countdown)
}

/** Active-task capacity for the current employee. */
export interface Capacity {
  active: number;
  max: number;
  canPick: boolean;
}

export interface TimeLogSummary {
  id: number;
  taskId: number | null;
  taskName: string | null;
  employeeName: string | null;
  workDate: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  running: boolean;
  workingTimeMinutes: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  remarks: string | null;
  approvedBy: string | null;
}

export interface Timesheet {
  from: string;
  to: string;
  logs: TimeLogSummary[];
  draftMinutes: number;
  submittedMinutes: number;
  approvedMinutes: number;
}

export interface AssignmentSummary {
  employeeId: number;
  employeeName: string;
  role: string | null;
  status: AssignmentStatus;
  assignedDate: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ChecklistItem {
  id: number;
  content: string;
  isCompleted: boolean;
  orderIndex: number;
}

export interface Checklist {
  id: number;
  name: string;
  items: ChecklistItem[];
}

export interface CommentSummary {
  id: number;
  content: string;
  authorName: string | null;
  role: string | null;
  createdAt: string;
}

export interface AttachmentSummary {
  id: number;
  fileName: string;
  fileUrl: string;
}

export interface ProgressMediaItem {
  mediaType: MediaType;
  fileUrl: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
}

export interface ProgressSummary {
  id: number;
  employeeName: string | null;
  progressPercent: number | null;
  remarks: string | null;
  timeSpentMinutes: number | null;
  createdAt: string;
  media: ProgressMediaItem[];
}

export interface IssueSummary {
  id: number;
  issueType: IssueType;
  description: string | null;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  employeeName: string | null;
  reportedAt: string;
  resolvedAt: string | null;
}

export interface MaterialUsageSummary {
  id: number;
  productName: string | null;
  quantityUsed: number;
  unit: string | null;
  usedByName: string | null;
  usedAt: string;
  remarks: string | null;
}

export interface CheckInSummary {
  id: number;
  employeeName: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  locationLabel: string | null;
}

export type LeadFormType =
  | 'FOLLOW_UP' | 'REQUIREMENT' | 'QUALIFY' | 'SCHEDULE_VISIT' | 'SITE_VISIT' | 'REVIEW';

export interface LeadFormMedia { url: string; type: string; caption?: string }

export interface LeadFormPayload {
  outcome?: string;
  notes?: string;
  nextFollowUpDate?: string;
  media?: LeadFormMedia[];
  data?: Record<string, string | number | boolean | null>;
}

/** Read-only snapshot of the original lead (as captured), shown on lead-workflow tasks so the field
 *  employee has full context. Mirrors EmployeeTaskService.toLeadInfo — all fields optional/nullable. */
export interface LeadInfo {
  id?: number;
  leadNumber?: string | null;
  name?: string | null;
  companyName?: string | null;
  contactPerson?: string | null;
  leadType?: string | null;
  leadSource?: string | null;
  priority?: string | null;
  status?: string | null;
  stage?: string | null;
  leadTemperature?: string | null;
  rating?: number | null;
  mobileNumber?: string | null;
  alternateMobile?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  gstNumber?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  landmark?: string | null;
  googleMapLocation?: string | null;
  propertyType?: string | null;
  propertyName?: string | null;
  siteAddress?: string | null;
  currentConstructionStage?: string | null;
  floorCount?: number | null;
  areaSqft?: number | string | null;
  expectedWorkArea?: number | string | null;
  requirementCategory?: string | null;
  requirementProduct?: string | null;
  projectDescription?: string | null;
  customerRequirements?: string | null;
  roomsRequired?: string | null;
  specialRequests?: string | null;
  preferredDesignStyle?: string | null;
  preferredMaterial?: string | null;
  preferredColorTheme?: string | null;
  estimatedDuration?: string | null;
  preferredCompletionDate?: string | null;
  scope?: string[];
  estimatedBudget?: number | string | null;
  minimumBudget?: number | string | null;
  maximumBudget?: number | string | null;
  expectedProjectValue?: number | string | null;
  paymentPreference?: string | null;
  expectedStartDate?: string | null;
  expectedEndDate?: string | null;
  nextFollowUpDate?: string | null;
  followUpNotes?: string | null;
  siteVisitDate?: string | null;
  referralType?: string | null;
  referrerName?: string | null;
  referrerContact?: string | null;
  referralNotes?: string | null;
  remarks?: string | null;
  media?: LeadMediaItem[];
}

/** A photo / voice note / video / file attached to the lead at capture. */
export interface LeadMediaItem {
  fileName?: string | null;
  fileUrl: string;
  category?: string | null;
  kind: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE';
}

export interface TaskDetail extends TaskCard {
  description: string | null;
  assignmentType: 'SINGLE_EMPLOYEE' | 'MULTIPLE_EMPLOYEES' | 'TEAM' | null;
  completionRule: string | null;
  formType?: LeadFormType | null;
  leadId?: number | null;
  lead?: LeadInfo | null;
  moduleDriven?: boolean;
  moduleLink?: string | null;
  moduleLabel?: string | null;
  customer: string | null;
  location: string | null;
  mapUrl?: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  startDate: string | null;
  completedDate: string | null;
  team: AssignmentSummary[];
  checklist: Checklist[];
  comments: CommentSummary[];
  attachments: AttachmentSummary[];
  progress: ProgressSummary[];
  issues: IssueSummary[];
  materialUsage: MaterialUsageSummary[];
  checkins: CheckInSummary[];
}

export interface HomeSummary {
  dueToday: number;
  overdue: number;
  upcoming: number;
  completedToday: number;
  todaysTasks: TaskCard[];
  activeTaskCount?: number;
  maxActiveTasks?: number;
  availableCount?: number;
}

export interface ReportsSummary {
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  reworkTasks: number;
  averageActualHours: number;
  completedByEmployee: Record<string, number>;
}
