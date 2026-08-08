import api from '../lib/api';
import { ChangeRequestPhaseAction, ProjectChangeRequest } from '../types/changeRequest';
import { PageResponse } from '../types/boq';

// Thin typed wrapper around /api/change-requests endpoints, mirroring boqApi.ts.

const BASE = '/change-requests';

export const changeRequestApi = {
  list: (status?: string, page = 0, size = 10) =>
    api.get<PageResponse<ProjectChangeRequest>>(`${BASE}?${status ? `status=${status}&` : ''}page=${page}&size=${size}`).then((r) => r.data),
  getByProject: (projectId: number) =>
    api.get<ProjectChangeRequest[]>(`${BASE}/project/${projectId}`).then((r) => r.data),
  get: (id: number) => api.get<ProjectChangeRequest>(`${BASE}/${id}`).then((r) => r.data),
  create: (projectId: number, payload: Partial<ProjectChangeRequest>) =>
    api.post<ProjectChangeRequest>(`${BASE}/project/${projectId}`, payload).then((r) => r.data),

  getPhaseActions: (id: number) => api.get<ChangeRequestPhaseAction[]>(`${BASE}/${id}/phases`).then((r) => r.data),
  addPhaseAction: (id: number, projectPhaseId: number, action: 'ACTIVATE' | 'DEACTIVATE') =>
    api.post<ChangeRequestPhaseAction>(`${BASE}/${id}/phases`, { projectPhaseId, action }).then((r) => r.data),
  removePhaseAction: (lineId: number) => api.delete(`${BASE}/phases/${lineId}`),

  approve: (id: number) => api.post<ProjectChangeRequest>(`${BASE}/${id}/approve`).then((r) => r.data),
  reject: (id: number, reason?: string) =>
    api.post<ProjectChangeRequest>(`${BASE}/${id}/reject`, reason ? { reason } : {}).then((r) => r.data),
  complete: (id: number) => api.post<ProjectChangeRequest>(`${BASE}/${id}/complete`).then((r) => r.data),
};
