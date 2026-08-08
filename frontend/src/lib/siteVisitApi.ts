import api from "@/lib/api";

// Thin typed wrapper around /api/site-visits so pages/tabs share one surface.

export interface SiteVisitFilters {
  status?: string;
  visitType?: string;
  priority?: string;
  projectId?: number | string;
  customerId?: number | string;
  employeeId?: number | string;
  startDate?: string;
  endDate?: string;
}

/** Rough dimensions captured per room during the visit; carried into the Measurement module on creation. */
export interface SiteRoomMeasurement {
  id?: number;
  length?: number;
  width?: number;
  height?: number;
  ceilingHeight?: number;
  doors?: number;
  windows?: number;
  floorType?: string;
  wallFinish?: string;
  notes?: string;
}

const buildParams = (filters: SiteVisitFilters & { page?: number; size?: number }) => {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params[key] = String(value);
  });
  return params;
};

export const siteVisitApi = {
  list: (filters: SiteVisitFilters & { page?: number; size?: number } = {}) =>
    api.get("/site-visits", { params: buildParams(filters) }).then((r) => r.data),

  listAll: (params: { status?: string; startDate?: string; endDate?: string } = {}) =>
    api.get("/site-visits/all", { params }).then((r) => r.data),

  today: () => api.get("/site-visits/today").then((r) => r.data),

  search: (q: string, page = 0, size = 10) =>
    api.get("/site-visits/search", { params: { q, page, size } }).then((r) => r.data),

  dashboard: () => api.get("/site-visits/dashboard").then((r) => r.data),

  meta: () => api.get("/site-visits/meta").then((r) => r.data),

  get: (id: number | string) => api.get(`/site-visits/${id}`).then((r) => r.data),

  create: (payload: any) => api.post("/site-visits", payload).then((r) => r.data),

  update: (id: number | string, payload: any) => api.put(`/site-visits/${id}`, payload).then((r) => r.data),

  remove: (id: number | string) => api.delete(`/site-visits/${id}`),

  start: (id: number | string) => api.put(`/site-visits/${id}/start`, {}).then((r) => r.data),

  complete: (id: number | string, outcome: string, nextActionNotes?: string) =>
    api.put(`/site-visits/${id}/complete`, { outcome, nextActionNotes }).then((r) => r.data),

  cancel: (id: number | string, reason: string) =>
    api.put(`/site-visits/${id}/cancel`, { reason }).then((r) => r.data),

  reschedule: (id: number | string, newTime: string, reason: string) =>
    api.put(`/site-visits/${id}/reschedule`, { newTime, reason }).then((r) => r.data),

  scheduleFollowUp: (id: number | string) => api.post(`/site-visits/${id}/follow-up`, {}).then((r) => r.data),

  sign: (id: number | string, signature: string, customerName: string) =>
    api.put(`/site-visits/${id}/sign`, { signature, customerName }).then((r) => r.data),

  // Assignments
  getAssignments: (id: number | string) => api.get(`/site-visits/${id}/assignments`).then((r) => r.data),

  assignEmployee: (id: number | string, userId: number | string, role: string, remarks?: string) =>
    api.post(`/site-visits/${id}/assignments`, { userId, role, remarks }).then((r) => r.data),

  removeAssignment: (id: number | string, assignmentId: number | string) =>
    api.delete(`/site-visits/${id}/assignments/${assignmentId}`),

  acceptAssignment: (id: number | string, assignmentId: number | string) =>
    api.put(`/site-visits/${id}/assignments/${assignmentId}/accept`, {}).then((r) => r.data),

  markArrival: (id: number | string, assignmentId: number | string) =>
    api.put(`/site-visits/${id}/assignments/${assignmentId}/arrive`, {}).then((r) => r.data),

  completeAssignment: (id: number | string, assignmentId: number | string) =>
    api.put(`/site-visits/${id}/assignments/${assignmentId}/complete`, {}).then((r) => r.data),

  // Checklist
  getChecklist: (id: number | string) => api.get(`/site-visits/${id}/checklist`).then((r) => r.data),

  updateChecklistItem: (id: number | string, checklistId: number | string, isCompleted: boolean, remarks?: string) =>
    api.put(`/site-visits/${id}/checklist/${checklistId}`, { isCompleted, remarks }).then((r) => r.data),

  // Media
  getMedia: (id: number | string) => api.get(`/site-visits/${id}/media`).then((r) => r.data),

  addMedia: (id: number | string, payload: { mediaType: string; category?: string; fileUrl: string; description?: string }) =>
    api.post(`/site-visits/${id}/media`, payload).then((r) => r.data),

  // History
  getHistory: (id: number | string) => api.get(`/site-visits/${id}/history`).then((r) => r.data),

  // Rooms/measurements
  getRooms: (id: number | string) => api.get(`/site-visits/${id}/rooms`).then((r) => r.data),
  addRoom: (id: number | string, roomName: string) => api.post(`/site-visits/${id}/rooms`, { roomName }).then((r) => r.data),

  getRoomMeasurements: (roomId: number | string) =>
    api.get(`/site-visits/rooms/${roomId}/measurements`).then((r) => r.data),

  addRoomMeasurement: (roomId: number | string, payload: SiteRoomMeasurement) =>
    api.post(`/site-visits/rooms/${roomId}/measurements`, payload).then((r) => r.data),

  // Assignable users (reuse lead's endpoint since both draw from the same user pool)
  getAssignableUsers: () => api.get("/leads/assignable-users").then((r) => r.data),
};
