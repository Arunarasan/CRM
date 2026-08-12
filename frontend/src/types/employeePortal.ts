// Types for the Employee Self-Service Portal (/api/employee-portal).
// The backend returns JPA entities for profile/attendance/leave/salary/documents and
// hand-built Maps for the dashboard + projects, so entity types are precise and the
// Map-backed ones are intentionally loose.

export interface EmployeeProfile {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  designation: string | null;
  status: string;
  dateOfJoining: string | null;
  profilePhotoUrl: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  salaryType: string | null;
  shift: string | null;
  baseSalary: number | null;
  pfNumber: string | null;
  esiNumber: string | null;
  bankAccount: string | null;
  ifsc: string | null;
  uan: string | null;
  department?: { id: number; name: string } | null;
  workforce?: Record<string, unknown> | null;
}

export interface TimeStatus {
  clockedIn: boolean;
  onBreak: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  breakMinutes: number;
  sessionsToday: number;
  hourlyRate: number | null;
  todayHours: number;
  todayOvertime: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
}

export interface EmployeeDashboard {
  employee: EmployeeProfile;
  todayAttendance: string; // NOT_MARKED | PRESENT | ABSENT | HALF_DAY | LEAVE
  todayCheckIn: string | null;
  todayCheckOut: string | null;
  todaysTasks: number;
  overdueTasks: number;
  upcomingDeadlines: number;
  assignedProjects: number;
  pendingLeaves: number;
  leaveBalance: number;
  lastSalaryStatus: string; // NONE | PENDING | PAID
  lastSalaryMonth: string | null;
  unreadNotifications: number;
  profileCompletion: number;
  time: TimeStatus;
  performance?: DashboardPerformance;
  requests?: DashboardRequests;
  recentActivity?: Record<string, RecentActivityItem | null>;
}

export interface DashboardPerformance {
  tasksCompletedThisWeek: number;
  tasksCompletedToday: number;
  tasksPending: number;
  hoursToday: number | null;
  hoursThisWeek: number | null;
  overtimeHours: number | null;
  monthEarnings: number | null;
  attendancePercentage: number;
  productivityScore: number;
}

export interface DashboardRequests {
  materialRequests: number;
  manpowerRequests: number;
  leaveRequests: number;
  leads: number;
  dailyReports: number;
  pendingApprovals: number;
}

export interface RecentActivityItem {
  label: string;
  status: string;
}

export interface TimesheetLine {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  breakMinutes: number;
  hours: number;
  overtime: number;
  earnings: number;
}

export interface Timesheet {
  period: string; // DAILY | WEEKLY | MONTHLY
  from: string;
  to: string;
  hourlyRate: number | null;
  lines: TimesheetLine[];
  totalHours: number;
  totalOvertime: number;
  totalEarnings: number;
}

export interface AttendanceEntry {
  id: number;
  date: string;
  status: string; // PRESENT | ABSENT | HALF_DAY | LEAVE
  checkInTime: string | null;
  checkOutTime: string | null;
  remarks: string | null;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequestEntry {
  id: number;
  startDate: string;
  endDate: string;
  type: string; // SICK | CASUAL | EARNED | MATERNITY
  reason: string | null;
  status: LeaveStatus;
  approvedBy: string | null;
}

export interface LeaveBalance {
  annualAllowance: number;
  taken: number;
  remaining: number;
}

export interface Payslip {
  id: number;
  month: number;
  year: number;
  basic: number;
  hra: number;
  overtimeAmount: number;
  bonus: number;
  incentive: number;
  grossEarnings: number;
  pfAmount: number;
  esiAmount: number;
  professionalTax: number;
  advanceRecovery: number;
  loanRecovery: number;
  leaveDeduction: number;
  totalDeductions: number;
  netSalary: number;
  status: string; // PENDING | PAID
  paymentDate: string | null;
  payslipNumber: string | null;
  workingDays: number | null;
  paidDays: number | null;
  lopDays: number | null;
  // Hourly payslip breakdown (V25)
  payType?: string;
  hourlyRate?: number | null;
  overtimeRate?: number | null;
  workedHours?: number | null;
  regularHours?: number | null;
  overtimeHours?: number | null;
  attendanceDays?: number | null;
  regularEarnings?: number | null;
  projectBonus?: number | null;
  manualBonus?: number | null;
  manualDeduction?: number | null;
}

export interface SalarySummary {
  structure: Record<string, unknown> | null;
  baseSalary: number | null;
  salaryType: string | null;
  payslips: Payslip[];
}

export interface EmployeeDocumentEntry {
  id: number;
  documentName: string;
  documentType: string;
  fileUrl: string;
  uploadedDate: string | null;
}

export interface MyProject {
  id: number;
  projectName: string;
  location: string | null;
  status: string;
  progress: number | null;
  projectManager: string | null;
  myTaskCount: number;
  myCompletedCount: number;
}

export interface OtherProject {
  id: number;
  projectName: string;
  location: string | null;
  status: string;
  progress: number | null;
  projectManager: string | null;
  openTaskCount: number;
}

/** A task an employee can pick up (self-assign). Shape mirrors the task card used elsewhere. */
export interface PickableTask {
  id: number;
  taskName: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  room: string | null;
  floor: string | null;
  itemName: string | null;
}

// --- Operational self-service (Phase 2) ---------------------------------

export interface MaterialOption {
  id: number;
  name: string;
  unit: string | null;
}

export interface MaterialRequestItem {
  id: number;
  product?: { id: number; name: string; unit?: string | null } | null;
  quantity: number;
  issuedQuantity?: number;
}

export interface MaterialRequestEntry {
  id: number;
  requestNumber: string;
  status: string; // PENDING | APPROVED | REJECTED | ISSUED
  remarks: string | null;
  project?: { id: number; projectName?: string } | null;
  items: MaterialRequestItem[];
  createdAt?: string;
}

export interface MaterialRequestCreateBody {
  projectId?: number | null;
  taskId?: number | null;
  reason?: string;
  priority?: string;
  expectedDate?: string;
  items: { productId: number; quantity: number }[];
}

export interface LeadSummary {
  id: number;
  leadNumber: string;
  name: string;
  mobileNumber: string | null;
  email: string | null;
  city: string | null;
  status: string;
  stage: string | null;
  requirementCategory: string | null;
  estimatedBudget: number | null;
  siteVisitDate: string | null;
  createdAt: string | null;
}

export interface LeadCreateBody {
  name: string;
  mobileNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  requirementCategory?: string;
  requirement?: string;
  estimatedBudget?: number | string;
  preferredVisitDate?: string;
  notes?: string;
}

// --- Phase 3 net-new modules --------------------------------------------

export interface ManpowerRequestEntry {
  id: number;
  requestNumber: string;
  status: string; // PENDING | APPROVED | REJECTED | ASSIGNED
  project?: { id: number; projectName?: string } | null;
  currentWorkers: number | null;
  requiredWorkers: number;
  skillRequired: string | null;
  reason: string | null;
  priority: string | null;
  requiredDate: string | null;
  remarks: string | null;
  createdAt?: string;
}

export interface ManpowerRequestCreateBody {
  projectId?: number | null;
  taskId?: number | null;
  currentWorkers?: number | string;
  requiredWorkers: number | string;
  skillRequired?: string;
  reason?: string;
  priority?: string;
  requiredDate?: string;
}

export interface DailyReportMediaItem {
  id?: number;
  mediaType: string; // PHOTO | VIDEO
  fileUrl: string;
  caption?: string | null;
}

export interface DailyReportEntry {
  id: number;
  reportDate: string;
  status: string;
  project?: { id: number; projectName?: string } | null;
  todaysWork: string | null;
  hoursWorked: number | null;
  completedWork: string | null;
  pendingWork: string | null;
  problems: string | null;
  materialUsed: string | null;
  materialRequired: string | null;
  remarks: string | null;
  managerComment: string | null;
  media: DailyReportMediaItem[];
  createdAt?: string;
}

export interface DailyReportCreateBody {
  projectId?: number | null;
  taskId?: number | null;
  reportDate?: string;
  todaysWork?: string;
  hoursWorked?: number | string;
  completedWork?: string;
  pendingWork?: string;
  problems?: string;
  materialUsed?: string;
  materialRequired?: string;
  remarks?: string;
  media?: { mediaType: string; fileUrl: string; caption?: string }[];
}

export interface PersonalReminderEntry {
  id: number;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: string | null;
  status: string; // PENDING | DONE
  completedAt: string | null;
}

export interface ReminderCreateBody {
  title: string;
  notes?: string;
  dueDate?: string;
  priority?: string;
}

export interface BonusEntry {
  id: number;
  bonusType: string; // PROJECT_COMPLETION | PERFORMANCE | FESTIVAL | ATTENDANCE | OTHER
  amount: number;
  status: string; // PENDING | APPROVED | PAID
  reason: string | null;
  awardDate: string | null;
  projectName: string | null;
}

export interface MyBonuses {
  bonuses: BonusEntry[];
  bonusPaidTotal: number;
  bonusPendingTotal: number;
}
