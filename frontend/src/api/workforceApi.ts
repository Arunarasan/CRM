import api from '../lib/api';
import {
  WorkforceResourceView,
  WorkforceDashboard,
  WorkforceListRow,
  WorkforceDetail,
  WorkforceDocument,
  WorkforceRequest,
  WorkforceMeta,
} from '../types/workforce';

// Unified Workforce module. Two concerns:
//  - Master data: one directory, one "Add Workforce" flow, one profile, reports.
//  - Assignment view: employees + contractors as one assignable pool (existing /resources, /dashboard).
// Endpoints return ApiResponse<T>, auto-unwrapped by the axios interceptor in lib/api.ts.

const BASE = '/workforce';

export interface WorkforceListParams {
  type?: string;
  skill?: string;
  status?: string;
  department?: string;
  company?: string;
  search?: string;
}

function qs(params?: Record<string, string | undefined>) {
  if (!params) return '';
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const workforceApi = {
  // --- master data ---
  list: (params?: WorkforceListParams) =>
    api.get<WorkforceListRow[]>(`${BASE}${qs(params as Record<string, string | undefined>)}`).then((r) => r.data),
  meta: () => api.get<WorkforceMeta>(`${BASE}/meta`).then((r) => r.data),
  get: (id: number) => api.get<WorkforceDetail>(`${BASE}/${id}`).then((r) => r.data),
  create: (body: WorkforceRequest) => api.post<WorkforceDetail>(BASE, body).then((r) => r.data),
  update: (id: number, body: WorkforceRequest) =>
    api.put<WorkforceDetail>(`${BASE}/${id}`, body).then((r) => r.data),
  documents: (id: number) =>
    api.get<WorkforceDocument[]>(`${BASE}/${id}/documents`).then((r) => r.data),
  addDocument: (id: number, doc: Partial<WorkforceDocument>) =>
    api.post<WorkforceDocument>(`${BASE}/${id}/documents`, doc).then((r) => r.data),
  report: (type: string) =>
    api.get<Record<string, unknown>>(`${BASE}/reports/${type}`).then((r) => r.data),
  finance: (id: number) =>
    api.get<Record<string, unknown>>(`${BASE}/${id}/finance`).then((r) => r.data),

  // --- assignment view (unchanged) ---
  listResources: (params?: { search?: string; type?: string }) =>
    api.get<WorkforceResourceView[]>(`${BASE}/resources${qs(params)}`).then((r) => r.data),
  dashboard: () => api.get<WorkforceDashboard>(`${BASE}/dashboard`).then((r) => r.data),
};
