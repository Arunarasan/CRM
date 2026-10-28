import api from '../lib/api';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import { toast } from '@/components/ui/toast';
import type { Bundle } from './bundleApi';
import {
  EmployeeProfile, EmployeeDashboard, AttendanceEntry, LeaveRequestEntry,
  LeaveBalance, Payslip, SalarySummary, EmployeeDocumentEntry, MyProject, OtherProject, PickableTask,
  TimeStatus, Timesheet, TimesheetPeriod, MaterialOption, MaterialRequestEntry, MaterialRequestCreateBody,
  LeadSummary, LeadCreateBody, ManpowerRequestEntry, ManpowerRequestCreateBody,
  DailyReportEntry, DailyReportCreateBody, PersonalReminderEntry, ReminderCreateBody,
  MyBonuses, MyRewards, MyCelebrations, PortalSearchResult, MonthlyEarning, PayrollRequestEntry, PayrollRequestCreateBody, MyLoan, MyAdvance,
  IncomingReceiptPo, ReceiptWarehouse, GoodsReceiptSubmission, MyReceipt,
  ProfileChangeRequest, ProfileChangeBody, DocumentSubmitBody, AttendanceCorrection,
} from '../types/employeePortal';

// Thin typed wrapper around /api/employee-portal — the employee self-service surface.
// Every endpoint is scoped server-side to the signed-in employee; no id is ever passed.
// Responses are auto-unwrapped from ApiResponse by the axios interceptor (lib/api.ts).

const BASE = '/employee-portal';

/**
 * POST that survives a dead connection: with no signal the request is saved on the phone and sent
 * automatically later (once, thanks to its Idempotency-Key). Callers get the submitted body back as
 * a stand-in for the server record, which is only used to close the form.
 */
async function postOrQueue<T>(url: string, body: unknown, description: string): Promise<T> {
  const r = await runOrQueue<T>({ method: 'post', url, payload: body, description });
  if (r.queued) {
    toast.info('Saved on your phone - it will be sent automatically when you are online');
    return body as unknown as T;
  }
  return r.data as T;
}


export const employeePortalApi = {
  me: () => api.get<EmployeeProfile>(`${BASE}/me`).then((r) => r.data),
  // Personal review QR: my shareable review link + captured-review summary.
  reviewQr: () => api.get<{
    token: string; employeeName: string; designation?: string;
    googleReviewUrl: string | null; reviewCount: number; averageRating: number;
  }>(`${BASE}/review-qr`).then((r) => r.data),
  dashboard: () => api.get<EmployeeDashboard>(`${BASE}/dashboard`).then((r) => r.data),
  profile: () => api.get<EmployeeProfile>(`${BASE}/profile`).then((r) => r.data),
  // Profile self-edits now go through admin approval — this submits a PENDING change request.
  submitProfileChange: (updates: ProfileChangeBody) =>
    api.put<ProfileChangeRequest>(`${BASE}/profile`, updates).then((r) => r.data),
  profileChangeRequests: () =>
    api.get<ProfileChangeRequest[]>(`${BASE}/profile-change-requests`).then((r) => r.data),
  submitDocument: (body: DocumentSubmitBody) =>
    api.post<ProfileChangeRequest>(`${BASE}/documents`, body).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    // The shared auth endpoint keeps this device signed in (new session cookie) and signs out the rest.
    api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => {
      if (r.data?.token) localStorage.setItem('token', r.data.token);
      return r.data;
    }),

  attendance: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return api.get<AttendanceEntry[]>(`${BASE}/attendance${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },

  // Time-clock + hourly earnings
  timeStatus: () => api.get<TimeStatus>(`${BASE}/time`).then((r) => r.data),
  clockIn: (payload?: {
    lat?: number; lng?: number; accuracyMeters?: number; locationLabel?: string; deviceInfo?: string;
    assertion?: { credentialId: string; authenticatorData: string; clientDataJSON: string; signature: string; userHandle: string | null };
    note?: string; // field punch: where the employee is
  }) => api.post<TimeStatus>(`${BASE}/attendance/clock-in`, payload ?? {}).then((r) => r.data),

  // Self-service switch to biometric attendance (admin-approved)
  requestBiometricAttendance: () => api.post<TimeStatus>(`${BASE}/attendance/request-biometric`).then((r) => r.data),
  cancelMethodRequest: () => api.post<TimeStatus>(`${BASE}/attendance/cancel-method-request`).then((r) => r.data),

  // Attendance time-correction (regularization) requests
  requestCorrection: (body: { date: string; checkIn?: string; checkOut?: string; reason?: string }) =>
    api.post(`${BASE}/attendance/corrections`, body).then((r) => r.data),
  myCorrections: () =>
    api.get<AttendanceCorrection[]>(`${BASE}/attendance/corrections`).then((r) => r.data),

  // WebAuthn (device biometric) for attendance
  webauthnRegisterOptions: () => api.post<any>(`${BASE}/webauthn/register/options`).then((r) => r.data),
  webauthnRegisterVerify: (body: { attestationObject: string; clientDataJSON: string; deviceLabel?: string }) =>
    api.post(`${BASE}/webauthn/register/verify`, body).then((r) => r.data),
  webauthnAssertOptions: () => api.post<any>(`${BASE}/webauthn/assert/options`).then((r) => r.data),
  webauthnCredentials: () =>
    api.get<{ id: number; deviceLabel: string; lastUsedAt: string | null; createdAt: string | null }[]>(`${BASE}/webauthn/credentials`).then((r) => r.data),
  webauthnDeleteCredential: (id: number) => api.delete(`${BASE}/webauthn/credentials/${id}`).then((r) => r.data),
  clockOut: (payload?: { lat?: number; lng?: number; accuracyMeters?: number; note?: string }) =>
    api.post<TimeStatus>(`${BASE}/attendance/clock-out`, payload ?? {}).then((r) => r.data),
  startBreak: () => api.post<TimeStatus>(`${BASE}/attendance/break/start`).then((r) => r.data),
  endBreak: () => api.post<TimeStatus>(`${BASE}/attendance/break/end`).then((r) => r.data),
  timesheet: (period: TimesheetPeriod, range?: { from: string; to: string }) =>
    api.get<Timesheet>(`${BASE}/timesheet`, { params: { period, ...(range ?? {}) } }).then((r) => r.data),

  // Goods receipt — receive & approve incoming purchase-order goods
  incomingReceipts: () => api.get<IncomingReceiptPo[]>(`${BASE}/goods-receipts/incoming`).then((r) => r.data),
  receiptWarehouses: () => api.get<ReceiptWarehouse[]>(`${BASE}/goods-receipts/warehouses`).then((r) => r.data),
  receiveGoods: (payload: GoodsReceiptSubmission) =>
    api.post<MyReceipt>(`${BASE}/goods-receipts/receive`, payload).then((r) => r.data),
  myReceipts: () => api.get<MyReceipt[]>(`${BASE}/goods-receipts/mine`).then((r) => r.data),

  // Goods delivery — hand ready / in-process orders to the customer and collect the pending amount
  deliveries: () => api.get<Bundle[]>(`${BASE}/deliveries`).then((r) => r.data),
  deliverOrder: (id: number, body: {
    deliveredTo?: string; note?: string; photoUrl?: string;
    payments?: { method: string; amount: number; referenceNumber?: string }[];
  }) => api.post<Bundle>(`${BASE}/deliveries/${id}/deliver`, body).then((r) => r.data),

  leaves: () => api.get<LeaveRequestEntry[]>(`${BASE}/leaves`).then((r) => r.data),
  leaveBalance: () => api.get<LeaveBalance>(`${BASE}/leaves/balance`).then((r) => r.data),
  applyLeave: (payload: { type: string; startDate: string; endDate: string; reason?: string }) =>
    postOrQueue<LeaveRequestEntry>(`${BASE}/leaves`, payload, 'Leave request'),

  salary: () => api.get<SalarySummary>(`${BASE}/salary`).then((r) => r.data),
  rewards: () => api.get<MyRewards>(`${BASE}/rewards`).then((r) => r.data),
  search: (q: string) => api.get<PortalSearchResult>(`${BASE}/search`, { params: { q } }).then((r) => r.data),
  bonuses: () => api.get<MyBonuses>(`${BASE}/bonuses`).then((r) => r.data),
  monthlyEarnings: () => api.get<MonthlyEarning[]>(`${BASE}/monthly-earnings`).then((r) => r.data),

  // Payroll money requests (advance / loan repayment / other) — employee raises, admin approves
  payrollRequests: () => api.get<PayrollRequestEntry[]>(`${BASE}/payroll-requests`).then((r) => r.data),
  createPayrollRequest: (body: PayrollRequestCreateBody) =>
    api.post<PayrollRequestEntry>(`${BASE}/payroll-requests`, body).then((r) => r.data),
  myLoans: () => api.get<MyLoan[]>(`${BASE}/loans`).then((r) => r.data),
  myAdvances: () => api.get<MyAdvance[]>(`${BASE}/advances`).then((r) => r.data),
  payslips: () => api.get<Payslip[]>(`${BASE}/payslips`).then((r) => r.data),
  // Gifts: a celebration card each time money is given
  celebrations: () => api.get<MyCelebrations>(`${BASE}/celebrations`).then((r) => r.data),
  openCelebration: (id: number) => api.post(`${BASE}/celebrations/${id}/open`).then((r) => r.data),
  openAllCelebrations: () => api.post(`${BASE}/celebrations/open-all`).then((r) => r.data),
  /** Dry-run payslip for a month HR hasn't generated yet (computed, never saved). */
  previewPayslip: (month: number, year: number) =>
    api.get<Payslip>(`${BASE}/payslips/preview`, { params: { month, year } }).then((r) => r.data),
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
    postOrQueue<MaterialRequestEntry>(`${BASE}/material-requests`, body, 'Material request'),
  searchMaterials: (q: string) =>
    api.get<MaterialOption[]>(`${BASE}/materials?q=${encodeURIComponent(q)}`).then((r) => r.data),

  // Leads (create-only + own)
  leads: () => api.get<LeadSummary[]>(`${BASE}/leads`).then((r) => r.data),
  createLead: (body: LeadCreateBody) => postOrQueue<LeadSummary>(`${BASE}/leads`, body, 'New lead'),

  // Manpower requests (own only)
  manpowerRequests: () => api.get<ManpowerRequestEntry[]>(`${BASE}/manpower-requests`).then((r) => r.data),
  createManpowerRequest: (body: ManpowerRequestCreateBody) =>
    postOrQueue<ManpowerRequestEntry>(`${BASE}/manpower-requests`, body, 'Manpower request'),

  // Daily reports (own only)
  dailyReports: () => api.get<DailyReportEntry[]>(`${BASE}/daily-reports`).then((r) => r.data),
  createDailyReport: (body: DailyReportCreateBody) =>
    postOrQueue<DailyReportEntry>(`${BASE}/daily-reports`, body, 'Daily report'),

  // Personal reminders ("Task Management", private)
  reminders: () => api.get<PersonalReminderEntry[]>(`${BASE}/reminders`).then((r) => r.data),
  createReminder: (body: ReminderCreateBody) =>
    postOrQueue<PersonalReminderEntry>(`${BASE}/reminders`, body, 'Reminder'),
  toggleReminder: (id: number) =>
    api.post<PersonalReminderEntry>(`${BASE}/reminders/${id}/toggle`).then((r) => r.data),
  deleteReminder: (id: number) => api.delete(`${BASE}/reminders/${id}`).then((r) => r.data),
};
