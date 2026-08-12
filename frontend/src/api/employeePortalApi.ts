import api from '../lib/api';
import {
  EmployeeProfile, EmployeeDashboard, AttendanceEntry, LeaveRequestEntry,
  LeaveBalance, Payslip, SalarySummary, EmployeeDocumentEntry, MyProject, OtherProject, PickableTask,
  TimeStatus, Timesheet, MaterialOption, MaterialRequestEntry, MaterialRequestCreateBody,
  LeadSummary, LeadCreateBody, ManpowerRequestEntry, ManpowerRequestCreateBody,
  DailyReportEntry, DailyReportCreateBody, PersonalReminderEntry, ReminderCreateBody,
  MyBonuses,
} from '../types/employeePortal';

// Thin typed wrapper around /api/employee-portal — the employee self-service surface.
// Every endpoint is scoped server-side to the signed-in employee; no id is ever passed.
// Responses are auto-unwrapped from ApiResponse by the axios interceptor (lib/api.ts).

const BASE = '/employee-portal';

export const employeePortalApi = {
  me: () => api.get<EmployeeProfile>(`${BASE}/me`).then((r) => r.data),
  dashboard: () => api.get<EmployeeDashboard>(`${BASE}/dashboard`).then((r) => r.data),
  profile: () => api.get<EmployeeProfile>(`${BASE}/profile`).then((r) => r.data),
  updateProfile: (updates: Partial<Record<'phone' | 'emergencyContactName' | 'emergencyContactPhone' | 'profilePhotoUrl', string>>) =>
    api.put<EmployeeProfile>(`${BASE}/profile`, updates).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post(`${BASE}/change-password`, { currentPassword, newPassword }).then((r) => r.data),

  attendance: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return api.get<AttendanceEntry[]>(`${BASE}/attendance${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },

  // Time-clock + hourly earnings
  timeStatus: () => api.get<TimeStatus>(`${BASE}/time`).then((r) => r.data),
  clockIn: (payload?: { lat?: number; lng?: number; locationLabel?: string; deviceInfo?: string }) =>
    api.post<TimeStatus>(`${BASE}/attendance/clock-in`, payload ?? {}).then((r) => r.data),
  clockOut: () => api.post<TimeStatus>(`${BASE}/attendance/clock-out`).then((r) => r.data),
  startBreak: () => api.post<TimeStatus>(`${BASE}/attendance/break/start`).then((r) => r.data),
  endBreak: () => api.post<TimeStatus>(`${BASE}/attendance/break/end`).then((r) => r.data),
  timesheet: (period: 'DAILY' | 'WEEKLY' | 'MONTHLY') =>
    api.get<Timesheet>(`${BASE}/timesheet?period=${period}`).then((r) => r.data),

  leaves: () => api.get<LeaveRequestEntry[]>(`${BASE}/leaves`).then((r) => r.data),
  leaveBalance: () => api.get<LeaveBalance>(`${BASE}/leaves/balance`).then((r) => r.data),
  applyLeave: (payload: { type: string; startDate: string; endDate: string; reason?: string }) =>
    api.post<LeaveRequestEntry>(`${BASE}/leaves`, payload).then((r) => r.data),

  salary: () => api.get<SalarySummary>(`${BASE}/salary`).then((r) => r.data),
  bonuses: () => api.get<MyBonuses>(`${BASE}/bonuses`).then((r) => r.data),
  payslips: () => api.get<Payslip[]>(`${BASE}/payslips`).then((r) => r.data),
  payslip: (id: number) => api.get<Payslip>(`${BASE}/payslips/${id}`).then((r) => r.data),

  documents: () => api.get<EmployeeDocumentEntry[]>(`${BASE}/documents`).then((r) => r.data),
  projects: () => api.get<MyProject[]>(`${BASE}/projects`).then((r) => r.data),
  otherProjects: () => api.get<OtherProject[]>(`${BASE}/projects/other`).then((r) => r.data),
  projectOpenTasks: (projectId: number) =>
    api.get<PickableTask[]>(`${BASE}/projects/${projectId}/open-tasks`).then((r) => r.data),
  pickUpTask: (taskId: number) => api.post(`${BASE}/tasks/${taskId}/pick-up`).then((r) => r.data),

  // Material requests (own only) + material-master lookup for the picker
  materialRequests: () => api.get<MaterialRequestEntry[]>(`${BASE}/material-requests`).then((r) => r.data),
  createMaterialRequest: (body: MaterialRequestCreateBody) =>
    api.post<MaterialRequestEntry>(`${BASE}/material-requests`, body).then((r) => r.data),
  searchMaterials: (q: string) =>
    api.get<MaterialOption[]>(`${BASE}/materials?q=${encodeURIComponent(q)}`).then((r) => r.data),

  // Leads (create-only + own)
  leads: () => api.get<LeadSummary[]>(`${BASE}/leads`).then((r) => r.data),
  createLead: (body: LeadCreateBody) => api.post<LeadSummary>(`${BASE}/leads`, body).then((r) => r.data),

  // Manpower requests (own only)
  manpowerRequests: () => api.get<ManpowerRequestEntry[]>(`${BASE}/manpower-requests`).then((r) => r.data),
  createManpowerRequest: (body: ManpowerRequestCreateBody) =>
    api.post<ManpowerRequestEntry>(`${BASE}/manpower-requests`, body).then((r) => r.data),

  // Daily reports (own only)
  dailyReports: () => api.get<DailyReportEntry[]>(`${BASE}/daily-reports`).then((r) => r.data),
  createDailyReport: (body: DailyReportCreateBody) =>
    api.post<DailyReportEntry>(`${BASE}/daily-reports`, body).then((r) => r.data),

  // Personal reminders ("Task Management", private)
  reminders: () => api.get<PersonalReminderEntry[]>(`${BASE}/reminders`).then((r) => r.data),
  createReminder: (body: ReminderCreateBody) =>
    api.post<PersonalReminderEntry>(`${BASE}/reminders`, body).then((r) => r.data),
  toggleReminder: (id: number) =>
    api.post<PersonalReminderEntry>(`${BASE}/reminders/${id}/toggle`).then((r) => r.data),
  deleteReminder: (id: number) => api.delete(`${BASE}/reminders/${id}`).then((r) => r.data),
};
