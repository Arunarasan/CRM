import api from "@/lib/api";
import type {
  CustomerOverview,
  CustomerDashboardStats,
  CustomerDocumentUnified,
  CustomerFollowUp,
  CustomerActivityLogEntry,
  CustomerFinancialSummary,
  CustomerProjectSummary,
  CustomerCommunicationSummary,
  PageResponse,
} from "@/types/customer360";

const base = (id: number | string) => `/customers/${id}`;

export const customer360Api = {
  getOverview: (id: number | string) =>
    api.get<CustomerOverview>(`${base(id)}/overview`).then((r) => r.data),

  getDashboard: (id: number | string) =>
    api.get<CustomerDashboardStats>(`${base(id)}/dashboard`).then((r) => r.data),

  getTimeline: (id: number | string, page = 0, size = 10) =>
    api
      .get<PageResponse<any>>(`${base(id)}/timeline`, { params: { page, size } })
      .then((r) => r.data),

  getActivityLog: (id: number | string, page = 0, size = 20) =>
    api
      .get<PageResponse<CustomerActivityLogEntry>>(`${base(id)}/activity-log`, { params: { page, size } })
      .then((r) => r.data),

  getDocuments: (id: number | string, page = 0, size = 10) =>
    api
      .get<PageResponse<CustomerDocumentUnified>>(`${base(id)}/documents`, { params: { page, size } })
      .then((r) => r.data),

  getFollowUps: (id: number | string, status?: string, page = 0, size = 10) =>
    api
      .get<PageResponse<CustomerFollowUp>>(`${base(id)}/follow-ups`, { params: { status, page, size } })
      .then((r) => r.data),

  addFollowUp: (id: number | string, payload: Record<string, any>) =>
    api.post<CustomerFollowUp>(`${base(id)}/follow-ups`, payload).then((r) => r.data),

  completeFollowUp: (id: number | string, followUpId: number, completionNotes?: string) =>
    api
      .post<CustomerFollowUp>(`${base(id)}/follow-ups/${followUpId}/complete`, { completionNotes })
      .then((r) => r.data),

  rescheduleFollowUp: (id: number | string, followUpId: number, newDate: string, reason?: string) =>
    api
      .post<CustomerFollowUp>(`${base(id)}/follow-ups/${followUpId}/reschedule`, { newDate, reason })
      .then((r) => r.data),

  cancelFollowUp: (id: number | string, followUpId: number, reason?: string) =>
    api
      .post<CustomerFollowUp>(`${base(id)}/follow-ups/${followUpId}/cancel`, { reason })
      .then((r) => r.data),

  getLeads: (id: number | string, page = 0, size = 10) =>
    api.get<PageResponse<any>>(`${base(id)}/leads`, { params: { page, size } }).then((r) => r.data),

  getSiteVisits: (id: number | string, page = 0, size = 10) =>
    api.get<PageResponse<any>>(`${base(id)}/site-visits`, { params: { page, size } }).then((r) => r.data),

  getMeasurements: (id: number | string, page = 0, size = 10) =>
    api.get<PageResponse<any>>(`${base(id)}/measurements`, { params: { page, size } }).then((r) => r.data),

  getQuotations: (id: number | string, page = 0, size = 10) =>
    api.get<PageResponse<any>>(`${base(id)}/quotations`, { params: { page, size } }).then((r) => r.data),

  getBoqs: (id: number | string, page = 0, size = 10) =>
    api.get<PageResponse<any>>(`${base(id)}/boqs`, { params: { page, size } }).then((r) => r.data),

  getProjects: (id: number | string, page = 0, size = 10) =>
    api.get<PageResponse<any>>(`${base(id)}/projects`, { params: { page, size } }).then((r) => r.data),

  getTasks: (id: number | string, page = 0, size = 10) =>
    api.get<PageResponse<any>>(`${base(id)}/tasks`, { params: { page, size } }).then((r) => r.data),

  getInvoices: (id: number | string, page = 0, size = 10) =>
    api.get<PageResponse<any>>(`${base(id)}/invoices`, { params: { page, size } }).then((r) => r.data),

  getPayments: (id: number | string, page = 0, size = 10) =>
    api.get<PageResponse<any>>(`${base(id)}/payments`, { params: { page, size } }).then((r) => r.data),

  getFinancialSummary: (id: number | string) =>
    api.get<CustomerFinancialSummary>(`${base(id)}/financial-summary`).then((r) => r.data),

  getProjectSummary: (id: number | string) =>
    api.get<CustomerProjectSummary>(`${base(id)}/project-summary`).then((r) => r.data),

  getCommunicationSummary: (id: number | string) =>
    api.get<CustomerCommunicationSummary>(`${base(id)}/communication-summary`).then((r) => r.data),

  assignEmployee: (id: number | string, employeeId: number) =>
    api.put<CustomerOverview>(`${base(id)}/assigned-employee`, { employeeId }).then((r) => r.data),

  // Reuses the existing POST /customers/{id}/activities endpoint (CustomerController),
  // whose DTO was extended with optional communication fields rather than adding a new one.
  logCommunication: (id: number | string, payload: Record<string, any>) =>
    api.post(`${base(id)}/activities`, payload).then((r) => r.data),

  // Reuses the existing POST /customers/{id}/documents endpoint (CustomerController).
  uploadDocument: (id: number | string, payload: { fileName: string; fileUrl: string; fileType?: string }) =>
    api.post(`${base(id)}/documents`, payload).then((r) => r.data),

  // ---- Portal access (customer self-service login) ----
  getPortalAccess: (id: number | string) =>
    api.get<PortalAccess>(`${base(id)}/portal-access`).then((r) => r.data),
  grantPortalAccess: (id: number | string, email?: string) =>
    api.post<PortalGrantResult>(`${base(id)}/portal-access`, email ? { email } : {}).then((r) => r.data),
  revokePortalAccess: (id: number | string, userId: number) =>
    api.delete(`${base(id)}/portal-access/${userId}`).then((r) => r.data),
  suspendPortalAccess: (id: number | string, userId: number, suspended: boolean) =>
    api.patch(`${base(id)}/portal-access/${userId}/suspend`, { suspended }).then((r) => r.data),

  // ---- Global portal on/off (site-wide) ----
  getPortalPolicy: () => api.get<{ enabled: boolean }>(`/website/portal-policy`).then((r) => r.data),
  setPortalPolicy: (enabled: boolean) =>
    api.put<{ enabled: boolean }>(`/website/portal-policy`, { enabled }).then((r) => r.data),
};

export interface PortalLogin {
  userId: number;
  name: string;
  email: string;
  portalRole: string;
  primary: boolean;
  emailVerified: boolean;
  suspended: boolean;
}
export interface PortalAccess {
  customerId: number;
  customerName?: string;
  customerEmail?: string;
  hasAccess: boolean;
  portalGloballyEnabled: boolean;
  logins: PortalLogin[];
}
export interface PortalGrantResult {
  email: string;
  linkedExistingAccount: boolean;
  temporaryPassword: string | null;
}

export default customer360Api;
