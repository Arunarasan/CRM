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
  progressPercent: number | null;
  assignedEmployees: string[];
  myAssignmentStatus?: AssignmentStatus;
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

export interface TaskDetail extends TaskCard {
  description: string | null;
  customer: string | null;
  location: string | null;
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
}

export interface ReportsSummary {
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  reworkTasks: number;
  averageActualHours: number;
  completedByEmployee: Record<string, number>;
}
