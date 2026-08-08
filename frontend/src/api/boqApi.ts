import api from '../lib/api';
import {
  Boq, BoqItem, BoqItemMaterial, BoqItemLabour, BoqPhase,
  BoqActivityLogEntry, BoqChangeLogEntry, BoqDiff, BoqDashboard, BoqMeta, PageResponse, BoqFilters,
  BoqReorderEntry,
} from '../types/boq';
import { Quotation } from '../types/quotation';

// Thin typed wrapper around /api/boq endpoints, mirroring measurementApi.ts.

const BASE = '/boq';

export const boqApi = {
  list(params: { search?: string; page?: number; size?: number; filters?: Partial<BoqFilters> }) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    query.set('page', String(params.page ?? 0));
    query.set('size', String(params.size ?? 10));
    Object.entries(params.filters || {}).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) query.set(key, String(value));
    });
    return api.get<PageResponse<Boq>>(`${BASE}?${query.toString()}`).then((r) => r.data);
  },

  dashboard: () => api.get<BoqDashboard>(`${BASE}/dashboard`).then((r) => r.data),
  meta: () => api.get<BoqMeta>(`${BASE}/meta`).then((r) => r.data),

  get: (id: number | string) => api.get<Boq>(`${BASE}/${id}`).then((r) => r.data),
  create: (payload: Partial<Boq>) => api.post<Boq>(BASE, payload).then((r) => r.data),
  createFromMeasurement: (measurementId: number) =>
    api.post<Boq>(`${BASE}/from-measurement/${measurementId}`).then((r) => r.data),
  /** Pulls rooms/items added to the source measurement since this BOQ was generated. */
  syncFromMeasurement: (id: number) =>
    api.post<{ itemsAdded: number; phases: number; roomsWithoutWork: string[]; message: string }>(
      `${BASE}/${id}/sync-from-measurement`).then((r) => r.data),
  update: (id: number, payload: Partial<Boq>) => api.put<Boq>(`${BASE}/${id}`, payload).then((r) => r.data),
  /** Edit only the pricing totals (discount / tax / material+labour overrides) without touching items. */
  updateTotals: (
    id: number,
    payload: {
      discountType?: "PERCENT" | "FLAT";
      discount?: number | null;
      taxPercent?: number | null;
      materialTotalOverride?: number | null;
      labourTotalOverride?: number | null;
    },
  ) => api.put<Boq>(`${BASE}/${id}/totals`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`${BASE}/${id}`),
  /** Persist a drag-and-drop layout: items in final visual order, each with its floor/room. */
  reorder: (id: number, items: BoqReorderEntry[]) =>
    api.post<Boq>(`${BASE}/${id}/reorder`, { items }).then((r) => r.data),

  getByCustomer: (customerId: number) => api.get<Boq[]>(`${BASE}/customer/${customerId}`).then((r) => r.data),
  getByProject: (projectId: number) => api.get<Boq[]>(`${BASE}/project/${projectId}`).then((r) => r.data),
  getByMeasurement: (measurementId: number) => api.get<Boq[]>(`${BASE}/measurement/${measurementId}`).then((r) => r.data),
  getByLead: (leadId: number) => api.get<Boq[]>(`${BASE}/lead/${leadId}`).then((r) => r.data),
  getMaster: (id: number) => api.get<Boq>(`${BASE}/${id}/master`).then((r) => r.data),

  // Items (floor / room / item)
  addItem: (id: number, item: Partial<BoqItem>) => api.post<BoqItem>(`${BASE}/${id}/items`, item).then((r) => r.data),
  updateItem: (id: number, itemId: number, item: Partial<BoqItem>, reason?: string) =>
    api.put<BoqItem>(`${BASE}/${id}/items/${itemId}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, item).then((r) => r.data),
  deleteItem: (id: number, itemId: number) => api.delete(`${BASE}/${id}/items/${itemId}`),
  selectItems: (id: number, itemIds: number[], selected: boolean) =>
    api.post(`${BASE}/${id}/items/select`, { itemIds, selected }),
  toggleItemActive: (id: number, itemId: number, active: boolean, reason?: string) =>
    api.put<BoqItem>(`${BASE}/${id}/items/${itemId}/toggle-active`, { active, reason }).then((r) => r.data),

  // Rooms (bulk over items sharing a phase+roomName)
  toggleRoomActive: (id: number, phaseId: number, roomName: string, active: boolean, reason?: string) =>
    api.put<BoqItem[]>(`${BASE}/${id}/rooms/toggle-active`, { phaseId, roomName, active, reason }).then((r) => r.data),
  moveRoom: (id: number, phaseId: number, roomName: string, targetPhaseId: number) =>
    api.post<BoqItem[]>(`${BASE}/${id}/rooms/move`, { phaseId, roomName, targetPhaseId }).then((r) => r.data),

  // Materials
  addMaterial: (id: number, itemId: number, material: Partial<BoqItemMaterial>) =>
    api.post<BoqItemMaterial>(`${BASE}/${id}/items/${itemId}/materials`, material).then((r) => r.data),
  updateMaterial: (id: number, itemId: number, materialId: number, material: Partial<BoqItemMaterial>, reason?: string) =>
    api.put<BoqItemMaterial>(`${BASE}/${id}/items/${itemId}/materials/${materialId}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, material).then((r) => r.data),
  deleteMaterial: (id: number, itemId: number, materialId: number) =>
    api.delete(`${BASE}/${id}/items/${itemId}/materials/${materialId}`),

  // Labour
  addLabour: (id: number, itemId: number, labour: Partial<BoqItemLabour>) =>
    api.post<BoqItemLabour>(`${BASE}/${id}/items/${itemId}/labour`, labour).then((r) => r.data),
  updateLabour: (id: number, itemId: number, labourId: number, labour: Partial<BoqItemLabour>, reason?: string) =>
    api.put<BoqItemLabour>(`${BASE}/${id}/items/${itemId}/labour/${labourId}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, labour).then((r) => r.data),
  deleteLabour: (id: number, itemId: number, labourId: number) =>
    api.delete(`${BASE}/${id}/items/${itemId}/labour/${labourId}`),

  // Phases
  getPhases: (id: number) => api.get<BoqPhase[]>(`${BASE}/${id}/phases`).then((r) => r.data),
  addPhase: (id: number, phase: Partial<BoqPhase>) => api.post<BoqPhase>(`${BASE}/${id}/phases`, phase).then((r) => r.data),
  updatePhase: (id: number, phaseId: number, phase: Partial<BoqPhase>, reason?: string) =>
    api.put<BoqPhase>(`${BASE}/${id}/phases/${phaseId}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, phase).then((r) => r.data),
  deletePhase: (id: number, phaseId: number) => api.delete(`${BASE}/${id}/phases/${phaseId}`),
  togglePhaseActive: (id: number, phaseId: number, active: boolean, reason?: string) =>
    api.put<BoqPhase>(`${BASE}/${id}/phases/${phaseId}/toggle-active`, { active, reason }).then((r) => r.data),
  splitPhase: (id: number, sourcePhaseId: number, newPhaseName: string, itemIds: number[]) =>
    api.post<BoqPhase>(`${BASE}/${id}/phases/split`, { sourcePhaseId, newPhaseName, itemIds }).then((r) => r.data),
  mergePhases: (id: number, phaseIdA: number, phaseIdB: number) =>
    api.post<BoqPhase>(`${BASE}/${id}/phases/merge`, { phaseIdA, phaseIdB }).then((r) => r.data),

  // Clone / revisions / compare
  clone: (id: number) => api.post<Boq>(`${BASE}/${id}/clone`).then((r) => r.data),
  createRevision: (id: number, reason?: string) =>
    api.post<Boq>(`${BASE}/${id}/revisions`, reason ? { reason } : undefined).then((r) => r.data),
  getRevisionFamily: (id: number) => api.get<Boq[]>(`${BASE}/${id}/revisions`).then((r) => r.data),
  compareVersions: (a: number, b: number) => api.get<Boq[]>(`${BASE}/compare?a=${a}&b=${b}`).then((r) => r.data),
  compareVersionsDetailed: (a: number, b: number) => api.get<BoqDiff>(`${BASE}/compare/detailed?a=${a}&b=${b}`).then((r) => r.data),

  // Approval workflow
  submitForReview: (id: number) => api.post<Boq>(`${BASE}/${id}/submit-for-review`).then((r) => r.data),
  approve: (id: number) => api.post<Boq>(`${BASE}/${id}/approve`).then((r) => r.data),
  reject: (id: number, reason?: string) =>
    api.post<Boq>(`${BASE}/${id}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`).then((r) => r.data),

  // Integration: generate quotation (full house / partial / budget)
  generateQuotation: (id: number, payload?: { mode?: string; itemIds?: number[]; budgetCap?: number }) =>
    api.post<Quotation>(`${BASE}/${id}/generate-quotation`, payload || { mode: 'FULL_HOUSE' }).then((r) => r.data),

  // Reports
  reportRoomWiseCost: (id: number) => api.get<any[]>(`${BASE}/${id}/reports/room-wise-cost`).then((r) => r.data),
  reportFloorWiseCost: (id: number) => api.get<any[]>(`${BASE}/${id}/reports/floor-wise-cost`).then((r) => r.data),
  reportMaterialConsumption: (id: number) => api.get<any[]>(`${BASE}/${id}/reports/material-consumption`).then((r) => r.data),
  reportInventoryRequirement: (id: number) => api.get<any[]>(`${BASE}/${id}/reports/inventory-requirement`).then((r) => r.data),
  reportLabourCost: (id: number) => api.get<any[]>(`${BASE}/${id}/reports/labour-cost`).then((r) => r.data),
  reportProfit: (id: number) => api.get<any>(`${BASE}/${id}/reports/profit`).then((r) => r.data),
  reportPendingWork: (id: number) => api.get<BoqItem[]>(`${BASE}/${id}/reports/pending-work`).then((r) => r.data),
  reportApprovedWork: (id: number) => api.get<BoqItem[]>(`${BASE}/${id}/reports/approved-work`).then((r) => r.data),

  // Activity log
  getActivityLog: (id: number) => api.get<BoqActivityLogEntry[]>(`${BASE}/${id}/activity-log`).then((r) => r.data),

  // Field-level change log (Modified By/Date/Reason/Previous/New Value) — the "Editable BOQ" audit trail.
  getChangeLog: (id: number) => api.get<BoqChangeLogEntry[]>(`${BASE}/${id}/change-log`).then((r) => r.data),
};
