import api from '../lib/api';

// Admin/manager view of employee daily reports. These hit /api/hr/** and return raw entities
// (not ApiResponse-wrapped), so `.data` is the payload directly.

export interface DailyReportMedia {
  id?: number;
  mediaType: string; // PHOTO | VIDEO
  fileUrl: string;
  caption?: string | null;
}

export interface AdminDailyReport {
  id: number;
  reportDate: string;
  todaysWork?: string | null;
  hoursWorked?: number | null;
  completedWork?: string | null;
  pendingWork?: string | null;
  problems?: string | null;
  materialUsed?: string | null;
  materialRequired?: string | null;
  remarks?: string | null;
  managerComment?: string | null;
  status: string; // SUBMITTED | REVIEWED
  createdAt?: string | null;
  employee?: { id: number; name: string; email?: string } | null;
  project?: { id: number; projectName?: string } | null;
  task?: { id: number; title?: string } | null;
  lead?: { id: number; leadNumber?: string; name?: string } | null;
  media: DailyReportMedia[];
}

export interface DailyReportFilters {
  employeeId?: number;
  projectId?: number;
  leadId?: number;
  status?: string;
  from?: string;
  to?: string;
}

export interface EmployeeLeadSummary {
  id: number;
  leadNumber?: string;
  name?: string;
  mobileNumber?: string;
  city?: string;
  status?: string;
  stage?: string;
  leadSource?: string;
  requirementCategory?: string;
  estimatedBudget?: number;
  isConverted?: boolean;
  createdAt?: string;
}

export interface DailyReportSummary {
  totalThisMonth: number;
  totalThisWeek: number;
  pendingReview: number;
  byEmployee: Record<string, number>;
  recent: Array<{ id: number; reportDate: string; employeeName?: string; projectName?: string; todaysWork?: string; status: string }>;
}

const clean = (f: DailyReportFilters = {}) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null));

export const dailyReportApi = {
  list: (filters: DailyReportFilters = {}) =>
    api.get<AdminDailyReport[]>(`/hr/daily-reports`, { params: clean(filters) }).then((r) => r.data),
  get: (id: number) =>
    api.get<AdminDailyReport>(`/hr/daily-reports/${id}`).then((r) => r.data),
  review: (id: number, managerComment?: string) =>
    api.post<AdminDailyReport>(`/hr/daily-reports/${id}/review`, { managerComment }).then((r) => r.data),
  summary: () =>
    api.get<DailyReportSummary>(`/hr/daily-reports/summary`).then((r) => r.data),
  forEmployee: (employeeId: number) =>
    api.get<AdminDailyReport[]>(`/hr/employees/${employeeId}/daily-reports`).then((r) => r.data),
  leadsForEmployee: (employeeId: number) =>
    api.get<EmployeeLeadSummary[]>(`/hr/employees/${employeeId}/leads`).then((r) => r.data),
};
