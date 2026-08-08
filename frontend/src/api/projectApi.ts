import api from '../lib/api';
import {
  ProjectPhase, ProjectRoom, ProjectRoomItem, ProjectMaterialRequirement,
  ProjectDailyLogEmployee, ProjectDailyLogMaterial, ProjectDailyLogMedia,
  ProjectProgress, ProjectModuleDashboard, GenerateFromBoqResult,
  ProjectItemProgressLog, ProjectProgressDashboard,
} from '../types/project';

// Thin typed wrapper around the new Enterprise PM endpoints on /api/projects.
// These endpoints return ApiResponse<T>-wrapped bodies, auto-unwrapped by the axios interceptor
// in lib/api.ts (unlike the legacy raw-entity Project endpoints called directly elsewhere).

const BASE = '/projects';

export const projectApi = {
  dashboard: () => api.get<ProjectModuleDashboard>(`${BASE}/dashboard`).then((r) => r.data),
  getProgress: (projectId: number) => api.get<ProjectProgress>(`${BASE}/${projectId}/progress`).then((r) => r.data),
  generateFromBoq: (projectId: number) =>
    api.post<GenerateFromBoqResult>(`${BASE}/${projectId}/generate-from-boq`).then((r) => r.data),

  // Phases
  getPhases: (projectId: number) => api.get<ProjectPhase[]>(`${BASE}/${projectId}/phases`).then((r) => r.data),
  addPhase: (projectId: number, phase: Partial<ProjectPhase>) =>
    api.post<ProjectPhase>(`${BASE}/${projectId}/phases`, phase).then((r) => r.data),
  updatePhase: (phaseId: number, phase: Partial<ProjectPhase>) =>
    api.put<ProjectPhase>(`${BASE}/phases/${phaseId}`, phase).then((r) => r.data),
  deletePhase: (phaseId: number) => api.delete(`${BASE}/phases/${phaseId}`),

  // Rooms
  getRooms: (phaseId: number) => api.get<ProjectRoom[]>(`${BASE}/phases/${phaseId}/rooms`).then((r) => r.data),
  addRoom: (phaseId: number, room: Partial<ProjectRoom>) =>
    api.post<ProjectRoom>(`${BASE}/phases/${phaseId}/rooms`, room).then((r) => r.data),
  updateRoom: (roomId: number, room: Partial<ProjectRoom>) =>
    api.put<ProjectRoom>(`${BASE}/rooms/${roomId}`, room).then((r) => r.data),
  deleteRoom: (roomId: number) => api.delete(`${BASE}/rooms/${roomId}`),

  // Room items
  getItems: (roomId: number) => api.get<ProjectRoomItem[]>(`${BASE}/rooms/${roomId}/items`).then((r) => r.data),
  addItem: (roomId: number, item: Partial<ProjectRoomItem>) =>
    api.post<ProjectRoomItem>(`${BASE}/rooms/${roomId}/items`, item).then((r) => r.data),
  updateItem: (itemId: number, item: Partial<ProjectRoomItem>) =>
    api.put<ProjectRoomItem>(`${BASE}/items/${itemId}`, item).then((r) => r.data),
  updateItemProgress: (
    itemId: number,
    payload: { progress?: number; status?: string; remarks?: string; photos?: string },
  ) => api.put<ProjectRoomItem>(`${BASE}/items/${itemId}/progress`, payload).then((r) => r.data),
  reopenItem: (itemId: number) =>
    api.post<ProjectRoomItem>(`${BASE}/items/${itemId}/reopen`).then((r) => r.data),
  getItemTimeline: (itemId: number) =>
    api.get<ProjectItemProgressLog[]>(`${BASE}/items/${itemId}/timeline`).then((r) => r.data),
  deleteItem: (itemId: number) => api.delete(`${BASE}/items/${itemId}`),

  // Progress dashboard (live cards + floor breakdown)
  getProgressDashboard: (projectId: number) =>
    api.get<ProjectProgressDashboard>(`${BASE}/${projectId}/progress-dashboard`).then((r) => r.data),

  // Materials
  getMaterials: (projectId: number) =>
    api.get<ProjectMaterialRequirement[]>(`${BASE}/${projectId}/materials`).then((r) => r.data),
  addMaterial: (projectId: number, requirement: Partial<ProjectMaterialRequirement> & { product: { id: number } }) =>
    api.post<ProjectMaterialRequirement>(`${BASE}/${projectId}/materials`, requirement).then((r) => r.data),
  updateMaterial: (reqId: number, requirement: Partial<ProjectMaterialRequirement>) =>
    api.put<ProjectMaterialRequirement>(`${BASE}/materials/${reqId}`, requirement).then((r) => r.data),
  requestPurchase: (reqId: number) =>
    api.post(`${BASE}/materials/${reqId}/request-purchase`).then((r) => r.data),

  // Project-scoped stock movements (stock entry / stock reduce) + purchase summary
  getMaterialTransactions: (projectId: number) =>
    api.get<any[]>(`${BASE}/${projectId}/material-transactions`).then((r) => r.data),
  recordMaterialTransaction: (projectId: number, tx: Record<string, unknown>) =>
    api.post<any>(`${BASE}/${projectId}/material-transactions`, tx).then((r) => r.data),
  getMaterialPurchaseSummary: (projectId: number) =>
    api.get<any[]>(`${BASE}/${projectId}/material-purchase-summary`).then((r) => r.data),

  // Daily log children
  getDailyLogDetail: (logId: number) => api.get<any>(`${BASE}/daily-logs/${logId}`).then((r) => r.data),
  addDailyLogEmployee: (logId: number, entry: Partial<ProjectDailyLogEmployee> & { employee: { id: number } }) =>
    api.post<ProjectDailyLogEmployee>(`${BASE}/daily-logs/${logId}/employees`, entry).then((r) => r.data),
  addDailyLogMaterial: (logId: number, entry: Partial<ProjectDailyLogMaterial> & { product: { id: number } }) =>
    api.post<ProjectDailyLogMaterial>(`${BASE}/daily-logs/${logId}/materials`, entry).then((r) => r.data),
  addDailyLogMedia: (logId: number, entry: Partial<ProjectDailyLogMedia>) =>
    api.post<ProjectDailyLogMedia>(`${BASE}/daily-logs/${logId}/media`, entry).then((r) => r.data),

  // Customer approval workflow
  approveApproval: (approvalId: number, remarks?: string) =>
    api.post(`${BASE}/approvals/${approvalId}/approve`, remarks ? { remarks } : {}).then((r) => r.data),
  rejectApproval: (approvalId: number, remarks?: string) =>
    api.post(`${BASE}/approvals/${approvalId}/reject`, remarks ? { remarks } : {}).then((r) => r.data),

  // Reports
  reportDelayedProjects: () => api.get<any[]>(`${BASE}/reports/delayed-projects`).then((r) => r.data),
  reportBudgetVsActual: () => api.get<any[]>(`${BASE}/reports/budget-vs-actual`).then((r) => r.data),
  reportMaterialConsumption: (projectId?: number) =>
    api.get<any[]>(`${BASE}/reports/material-consumption${projectId ? `?projectId=${projectId}` : ''}`).then((r) => r.data),
  reportLabourCost: () => api.get<any[]>(`${BASE}/reports/labour-cost`).then((r) => r.data),
  reportEmployeePerformance: () => api.get<any[]>(`${BASE}/reports/employee-performance`).then((r) => r.data),
  reportContractorPerformance: () => api.get<any[]>(`${BASE}/reports/contractor-performance`).then((r) => r.data),
  reportProfitAnalysis: () => api.get<any[]>(`${BASE}/reports/profit-analysis`).then((r) => r.data),
};
