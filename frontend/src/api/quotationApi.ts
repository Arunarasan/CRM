import api from '../lib/api';
import { Quotation, PageResponse } from '../types/quotation';
import { Boq } from '../types/boq';

interface EntityRef { id: number }

const BASE = '/quotations';

export const quotationApi = {
  list(params: { search?: string; page?: number; size?: number }) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    query.set('page', String(params.page ?? 0));
    query.set('size', String(params.size ?? 10));
    return api.get<PageResponse<Quotation>>(`${BASE}?${query.toString()}`).then((r) => r.data);
  },

  get: (id: number | string) => api.get<Quotation>(`${BASE}/${id}`).then((r) => r.data),
  create: (payload: Partial<Quotation>) => api.post<Quotation>(BASE, payload).then((r) => r.data),
  update: (id: number, payload: Partial<Quotation>) => api.put<Quotation>(`${BASE}/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`${BASE}/${id}`),

  syncFromBoq: (id: number) => api.post<Quotation>(`${BASE}/${id}/sync-from-boq`).then((r) => r.data),
  duplicate: (id: number) => api.post<Quotation>(`${BASE}/${id}/duplicate`).then((r) => r.data),
  createRevision: (id: number) => api.post<Quotation>(`${BASE}/${id}/revise`).then((r) => r.data),
  getRevisionFamily: (id: number) => api.get<Quotation[]>(`${BASE}/${id}/revisions`).then((r) => r.data),

  updateApprovalStatus: (id: number, status: string) =>
    api.put<Quotation>(`${BASE}/${id}/approval?status=${encodeURIComponent(status)}`).then((r) => r.data),

  // Item-level approval (drives partial execution)
  approveItems: (id: number, itemIds: number[]) =>
    api.post<Quotation>(`${BASE}/${id}/approve-items`, { itemIds }).then((r) => r.data),
  rejectItems: (id: number, itemIds: number[]) =>
    api.post<Quotation>(`${BASE}/${id}/reject-items`, { itemIds }).then((r) => r.data),

  reserveInventory: (id: number) => api.post(`${BASE}/${id}/reserve-inventory`),
  releaseInventory: (id: number) => api.post(`${BASE}/${id}/release-inventory`),

  convertToProject: (id: number, splitBy?: 'NONE' | 'FLOOR') =>
    api.post<EntityRef[]>(`${BASE}/${id}/convert-to-project${splitBy ? `?splitBy=${splitBy}` : ''}`).then((r) => r.data),

  saveSignature: (id: number, signature: string) =>
    api.put<Quotation>(`${BASE}/${id}/sign`, { signature }).then((r) => r.data),
};

export const boqQuotationApi = {
  generateFromBoq: (boqId: number, payload: { mode: string; itemIds?: number[]; budgetCap?: number }) =>
    api.post<Quotation>(`/boq/${boqId}/generate-quotation`, payload).then((r) => r.data),
  getBoq: (boqId: number) => api.get<Boq>(`/boq/${boqId}`).then((r) => r.data),
};
