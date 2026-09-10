import api from '@/lib/api';

// Admin/HR attendance verification: office geofences + review of flagged clock-ins.
// Endpoints (/api/hr/attendance/*) return raw payloads (no ApiResponse envelope), so r.data is the value.

export interface AttendanceLocation {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address?: string | null;
  active: boolean;
}

export interface PendingAttendance {
  sessionId: number;
  employeeId: number | null;
  employeeCode: string | null;
  employeeName: string;
  date: string | null;
  checkInTime: string | null;
  verificationMethod: string | null;
  flagReason: string | null;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  officeLocation: string | null;
  lat: number | null;
  lng: number | null;
  deviceInfo: string | null;
  approvalStatus: string | null;
}

export interface MethodRequest {
  employeeId: number;
  employeeCode: string | null;
  employeeName: string;
  currentMethod: string | null;
  requestedMethod: string | null;
  requestedAt: string | null;
}

const BASE = '/hr/attendance';

export const attendanceApi = {
  listLocations: () => api.get<AttendanceLocation[]>(`${BASE}/locations`).then((r) => r.data),
  saveLocation: (loc: AttendanceLocation) => api.post<AttendanceLocation>(`${BASE}/locations`, loc).then((r) => r.data),
  deleteLocation: (id: number) => api.delete(`${BASE}/locations/${id}`).then((r) => r.data),
  listPending: () => api.get<PendingAttendance[]>(`${BASE}/pending`).then((r) => r.data),
  approve: (sessionId: number) => api.post<PendingAttendance>(`${BASE}/sessions/${sessionId}/approve`).then((r) => r.data),
  reject: (sessionId: number) => api.post<PendingAttendance>(`${BASE}/sessions/${sessionId}/reject`).then((r) => r.data),

  listMethodRequests: () => api.get<MethodRequest[]>(`${BASE}/method-requests`).then((r) => r.data),
  approveMethodRequest: (employeeId: number) => api.post(`${BASE}/method-requests/${employeeId}/approve`).then((r) => r.data),
  rejectMethodRequest: (employeeId: number) => api.post(`${BASE}/method-requests/${employeeId}/reject`).then((r) => r.data),
};
