import api from '../lib/api';
import {
  Measurement, MeasurementRoom, MeasurementItem, MeasurementAssignment,
  MeasurementDrawing, MeasurementMedia, MeasurementChecklistItem, MeasurementHistoryEntry,
  MeasurementTimelineEvent, MeasurementActivityLogEntry, MeasurementDashboard, MeasurementMeta,
  UserSummary, PageResponse, MeasurementFilters,
} from '../types/measurement';

// Thin typed wrapper around /api/measurements endpoints so pages/tabs share one surface.

const BASE = '/measurements';

export const measurementApi = {
  list(params: { search?: string; page?: number; size?: number; sortBy?: string; sortDir?: string; filters?: Partial<MeasurementFilters> }) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    query.set('page', String(params.page ?? 0));
    query.set('size', String(params.size ?? 10));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortDir) query.set('sortDir', params.sortDir);
    Object.entries(params.filters || {}).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) query.set(key, String(value));
    });
    return api.get<PageResponse<Measurement>>(`${BASE}?${query.toString()}`).then((r) => r.data);
  },

  dashboard: () => api.get<MeasurementDashboard>(`${BASE}/dashboard`).then((r) => r.data),
  meta: () => api.get<MeasurementMeta>(`${BASE}/meta`).then((r) => r.data),
  assignableEmployees: () => api.get<UserSummary[]>(`${BASE}/assignable-employees`).then((r) => r.data),

  get: (id: number | string) => api.get<Measurement>(`${BASE}/${id}`).then((r) => r.data),
  create: (payload: Partial<Measurement>) => api.post<Measurement>(BASE, payload).then((r) => r.data),
  update: (id: number, payload: Partial<Measurement>) => api.put<Measurement>(`${BASE}/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`${BASE}/${id}`),

  // Assignments
  getAssignments: (id: number) => api.get<MeasurementAssignment[]>(`${BASE}/${id}/assignments`).then((r) => r.data),
  assignEmployee: (id: number, employeeId: number, role: string, remarks?: string) =>
    api.post<MeasurementAssignment>(`${BASE}/${id}/assignments`, { employeeId, role, remarks }).then((r) => r.data),
  acceptAssignment: (id: number, assignmentId: number) =>
    api.put<MeasurementAssignment>(`${BASE}/${id}/assignments/${assignmentId}/accept`).then((r) => r.data),
  completeAssignment: (id: number, assignmentId: number) =>
    api.put<MeasurementAssignment>(`${BASE}/${id}/assignments/${assignmentId}/complete`).then((r) => r.data),
  removeAssignment: (id: number, assignmentId: number) => api.delete(`${BASE}/${id}/assignments/${assignmentId}`),

  // Rooms
  getRooms: (id: number) => api.get<MeasurementRoom[]>(`${BASE}/${id}/rooms`).then((r) => r.data),
  getRoom: (id: number, roomId: number) => api.get<MeasurementRoom>(`${BASE}/${id}/rooms/${roomId}`).then((r) => r.data),
  addRoom: (id: number, room: MeasurementRoom) => api.post<MeasurementRoom>(`${BASE}/${id}/rooms`, room).then((r) => r.data),
  updateRoom: (id: number, roomId: number, room: MeasurementRoom) =>
    api.put<MeasurementRoom>(`${BASE}/${id}/rooms/${roomId}`, room).then((r) => r.data),
  deleteRoom: (id: number, roomId: number) => api.delete(`${BASE}/${id}/rooms/${roomId}`),

  // Room items
  getItems: (id: number, roomId: number) => api.get<MeasurementItem[]>(`${BASE}/${id}/rooms/${roomId}/items`).then((r) => r.data),
  addItem: (id: number, roomId: number, item: MeasurementItem) =>
    api.post<MeasurementItem>(`${BASE}/${id}/rooms/${roomId}/items`, item).then((r) => r.data),
  updateItem: (id: number, roomId: number, itemId: number, item: MeasurementItem) =>
    api.put<MeasurementItem>(`${BASE}/${id}/rooms/${roomId}/items/${itemId}`, item).then((r) => r.data),
  deleteItem: (id: number, roomId: number, itemId: number) => api.delete(`${BASE}/${id}/rooms/${roomId}/items/${itemId}`),

  // Bottom-up entry: add an item before any room is chosen (lands in the "Unassigned" bucket),
  // reassign an item to another room, and merge one room into another.
  addDraftItem: (id: number, item: MeasurementItem) =>
    api.post<MeasurementItem>(`${BASE}/${id}/items`, item).then((r) => r.data),
  moveItem: (id: number, itemId: number, targetRoomId: number) =>
    api.put<MeasurementItem>(`${BASE}/${id}/items/${itemId}/move`, { targetRoomId }).then((r) => r.data),
  mergeRooms: (id: number, sourceRoomId: number, targetRoomId: number) =>
    api.post<MeasurementRoom>(`${BASE}/${id}/rooms/merge`, { sourceRoomId, targetRoomId }).then((r) => r.data),

  // Drawings
  getDrawings: (id: number) => api.get<MeasurementDrawing[]>(`${BASE}/${id}/drawings`).then((r) => r.data),
  addDrawing: (id: number, drawing: MeasurementDrawing) =>
    api.post<MeasurementDrawing>(`${BASE}/${id}/drawings`, drawing).then((r) => r.data),
  deleteDrawing: (id: number, drawingId: number) => api.delete(`${BASE}/${id}/drawings/${drawingId}`),

  // Media
  getMedia: (id: number) => api.get<MeasurementMedia[]>(`${BASE}/${id}/media`).then((r) => r.data),
  addMedia: (id: number, media: MeasurementMedia) => api.post<MeasurementMedia>(`${BASE}/${id}/media`, media).then((r) => r.data),
  deleteMedia: (id: number, mediaId: number) => api.delete(`${BASE}/${id}/media/${mediaId}`),

  // Checklist
  getChecklist: (id: number) => api.get<MeasurementChecklistItem[]>(`${BASE}/${id}/checklist`).then((r) => r.data),
  toggleChecklistItem: (id: number, checklistId: number, completed: boolean) =>
    api.put<MeasurementChecklistItem>(`${BASE}/${id}/checklist/${checklistId}?completed=${completed}`).then((r) => r.data),

  // Approval workflow
  start: (id: number) => api.put<Measurement>(`${BASE}/${id}/start`).then((r) => r.data),
  submit: (id: number) => api.put<Measurement>(`${BASE}/${id}/submit`).then((r) => r.data),
  approve: (id: number, remarks?: string) =>
    api.put<Measurement>(`${BASE}/${id}/approve${remarks ? `?remarks=${encodeURIComponent(remarks)}` : ''}`).then((r) => r.data),
  reject: (id: number, reason: string) =>
    api.put<Measurement>(`${BASE}/${id}/reject?reason=${encodeURIComponent(reason)}`).then((r) => r.data),
  complete: (id: number) => api.put<Measurement>(`${BASE}/${id}/complete`).then((r) => r.data),
  cancel: (id: number, reason?: string) =>
    api.put<Measurement>(`${BASE}/${id}/cancel${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`).then((r) => r.data),

  // Revisions
  createRevision: (id: number, reason?: string) =>
    api.post<Measurement>(`${BASE}/${id}/revisions${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`).then((r) => r.data),
  getRevisionFamily: (id: number) => api.get<Measurement[]>(`${BASE}/${id}/revisions`).then((r) => r.data),
  getRevisionHistory: (id: number) => api.get<MeasurementHistoryEntry[]>(`${BASE}/${id}/revision-history`).then((r) => r.data),

  // Timeline / activity
  getTimeline: (id: number) => api.get<MeasurementTimelineEvent[]>(`${BASE}/${id}/timeline`).then((r) => r.data),
  getActivityLog: (id: number) => api.get<MeasurementActivityLogEntry[]>(`${BASE}/${id}/activity-log`).then((r) => r.data),
};

// --- Legacy named exports (kept for any pre-existing callers; delegate to measurementApi) ---

export const getMeasurements = async (): Promise<Measurement[]> => {
  const page = await measurementApi.list({ page: 0, size: 200 });
  return page.content;
};

export const getMeasurementById = (id: number) => measurementApi.get(id);

export const createMeasurement = (data: Measurement) => measurementApi.create(data);

export const updateMeasurement = (id: number, data: Measurement) => measurementApi.update(id, data);

export const getRoomsForMeasurement = (id: number) => measurementApi.getRooms(id);

export const addRoomToMeasurement = (id: number, room: MeasurementRoom) => measurementApi.addRoom(id, room);
