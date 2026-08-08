import api from '../lib/api';
import {
  TaskCard, TaskDetail, HomeSummary, ReportsSummary, ProgressMediaItem,
} from '../types/employeeTask';

// Thin typed wrapper around /api/employee-tasks (mobile field-execution) endpoints,
// mirroring boqApi.ts's conventions.

const BASE = '/employee-tasks';

export const employeeTaskApi = {
  home: () => api.get<HomeSummary>(`${BASE}/home`).then((r) => r.data),
  myTasks: (params?: { status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return api.get<TaskCard[]>(`${BASE}/my-tasks${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
  detail: (id: number) => api.get<TaskDetail>(`${BASE}/${id}`).then((r) => r.data),

  assign: (id: number, employeeIds: number[], role?: string) =>
    api.post(`${BASE}/${id}/assignments`, { employeeIds, role }).then((r) => r.data),
  // Unified: assign any workforce resource(s) — employees and/or contractors.
  assignResources: (
    id: number,
    resources: { resourceType: string; resourceId: number; role?: string }[],
  ) => api.post(`${BASE}/${id}/assignments`, { resources }).then((r) => r.data),
  unassign: (id: number, employeeId: number) => api.delete(`${BASE}/${id}/assignments/${employeeId}`),
  unassignResource: (id: number, resourceType: string, resourceId: number) =>
    api.delete(`${BASE}/${id}/assignments/${resourceType}/${resourceId}`),

  accept: (id: number) => api.post(`${BASE}/${id}/accept`).then((r) => r.data),
  start: (id: number) => api.post(`${BASE}/${id}/start`).then((r) => r.data),
  pause: (id: number, remarks?: string) => api.post(`${BASE}/${id}/pause`, { remarks }).then((r) => r.data),
  resume: (id: number) => api.post(`${BASE}/${id}/resume`).then((r) => r.data),
  complete: (id: number, remarks?: string) => api.post(`${BASE}/${id}/complete`, { remarks }).then((r) => r.data),
  approve: (id: number) => api.post(`${BASE}/${id}/approve`).then((r) => r.data),
  reject: (id: number, remarks: string) => api.post(`${BASE}/${id}/reject`, { remarks }).then((r) => r.data),

  addProgress: (id: number, payload: { progressPercent?: number; remarks?: string; timeSpentMinutes?: number; media?: ProgressMediaItem[] }) =>
    api.post(`${BASE}/${id}/progress`, payload).then((r) => r.data),

  toggleChecklistItem: (itemId: number) => api.post(`${BASE}/checklist-items/${itemId}/toggle`).then((r) => r.data),
  addChecklistItem: (id: number, content: string, checklistName?: string) =>
    api.post(`${BASE}/${id}/checklist`, { content, checklistName }).then((r) => r.data),

  reportIssue: (id: number, issueType: string, description: string) =>
    api.post(`${BASE}/${id}/issues`, { issueType, description }).then((r) => r.data),
  getIssues: (id: number) => api.get(`${BASE}/${id}/issues`).then((r) => r.data),

  logMaterialUsage: (id: number, productId: number, quantity: number, remarks?: string) =>
    api.post(`${BASE}/${id}/material-usage`, { productId, quantity, remarks }).then((r) => r.data),

  checkIn: (id: number, payload?: { latitude?: number; longitude?: number; locationLabel?: string }) =>
    api.post(`${BASE}/${id}/checkin`, payload).then((r) => r.data),
  checkOut: (id: number, payload?: { latitude?: number; longitude?: number }) =>
    api.post(`${BASE}/${id}/checkout`, payload).then((r) => r.data),

  reportsSummary: () => api.get<ReportsSummary>(`${BASE}/reports/summary`).then((r) => r.data),

  uploadFile: (file: File | Blob, module: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('module', module);
    return api.post<{ fileUrl: string; fileName: string }>('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};
