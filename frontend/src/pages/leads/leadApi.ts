import api from "@/lib/api";
import type { BoardColumn, DashboardMetrics, Lead, LeadFilters, UserSummary } from "./constants";

// Thin typed wrapper around /api/leads endpoints so pages/tabs share one surface.

export const leadApi = {
  list(params: {
    search?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: string;
    filters?: Partial<LeadFilters>;
  }) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    query.set("page", String(params.page ?? 0));
    query.set("size", String(params.size ?? 10));
    if (params.sortBy) query.set("sortBy", params.sortBy);
    if (params.sortDir) query.set("sortDir", params.sortDir);
    Object.entries(params.filters || {}).forEach(([key, value]) => {
      if (value !== "" && value !== undefined && value !== null) query.set(key, String(value));
    });
    return api.get(`/leads?${query.toString()}`);
  },

  dashboard: () => api.get<DashboardMetrics>("/leads/dashboard"),
  board: (assignedEmployeeId?: string) =>
    api.get<BoardColumn[]>(`/leads/board${assignedEmployeeId ? `?assignedEmployeeId=${assignedEmployeeId}` : ""}`),
  reports: () => api.get("/leads/reports"),
  assignableUsers: () => api.get<UserSummary[]>("/leads/assignable-users"),

  get: (id: string | number) => api.get<Lead>(`/leads/${id}`),
  create: (payload: Partial<Lead>) => api.post<Lead>("/leads", payload),
  update: (id: number, payload: Partial<Lead>) => api.put<Lead>(`/leads/${id}`, payload),
  remove: (id: number) => api.delete(`/leads/${id}`),

  updateStatus: (id: number, status: string, remarks?: string) =>
    api.put(`/leads/${id}/status?status=${encodeURIComponent(status)}${remarks ? `&remarks=${encodeURIComponent(remarks)}` : ""}`),
  assign: (id: number, userId: number, role: string) =>
    api.post(`/leads/${id}/assignments`, { userId, role }),
  getAssignments: (id: string | number) => api.get(`/leads/${id}/assignments`),

  updateReferral: (id: number, payload: {
    referralType: string | null;
    referredByCustomerId: number | null;
    referredByEmployeeId: number | null;
    referrerName: string | null;
    referrerContact: string | null;
    referralNotes: string | null;
  }) => api.put<Lead>(`/leads/${id}/referral`, payload),

  getFollowups: (id: string | number) => api.get(`/leads/${id}/follow-ups`),
  addFollowup: (id: string | number, payload: any) => api.post(`/leads/${id}/follow-ups`, payload),

  // Structured data captured by employees completing this lead's workflow tasks (Task Data log).
  getTaskSubmissions: (id: string | number) => api.get(`/leads/${id}/task-submissions`),

  getCommunications: (id: string | number) => api.get(`/leads/${id}/communications`),
  addCommunication: (id: string | number, payload: any) => api.post(`/leads/${id}/communications`, payload),

  getNotes: (id: string | number) => api.get(`/leads/${id}/notes`),
  addNote: (id: string | number, content: string) => api.post(`/leads/${id}/notes`, { content }),
  deleteNote: (id: string | number, noteId: number) => api.delete(`/leads/${id}/notes/${noteId}`),

  getDocuments: (id: string | number) => api.get(`/leads/${id}/documents`),
  addDocument: (id: string | number, payload: any) => api.post(`/leads/${id}/documents`, payload),
  deleteDocument: (id: string | number, documentId: number) =>
    api.delete(`/leads/${id}/documents/${documentId}`),

  getTasks: (id: string | number) => api.get(`/leads/${id}/tasks`),
  addTask: (id: string | number, payload: any) => api.post(`/leads/${id}/tasks`, payload),
  updateTaskStatus: (id: string | number, taskId: number, status: string) =>
    api.put(`/leads/${id}/tasks/${taskId}/status?status=${encodeURIComponent(status)}`),

  getSiteVisits: (id: string | number) => api.get(`/leads/${id}/site-visits`),
  scheduleSiteVisit: (id: string | number, payload: any) => api.post(`/leads/${id}/site-visits`, payload),

  getMeasurements: (id: string | number) => api.get(`/leads/${id}/measurements`),
  getQuotations: (id: string | number) => api.get(`/leads/${id}/quotations`),
  getBoqs: (id: string | number) => api.get(`/leads/${id}/boqs`),
  getProjects: (id: string | number) => api.get(`/leads/${id}/projects`),

  getActivities: (id: string | number) => api.get(`/leads/${id}/activities`),
  getStatusHistory: (id: string | number) => api.get(`/leads/${id}/status-history`),

  convertFull: (id: string | number, payload: any) => api.post(`/leads/${id}/convert-full`, payload),
  markLost: (id: string | number, payload: { reason: string; competitor?: string; feedback?: string }) =>
    api.post(`/leads/${id}/lost`, payload),
};
