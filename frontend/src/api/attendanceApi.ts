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
  deviceVerified?: boolean;
  deviceMismatchReason?: string | null; // set when the punch didn't come from the registered phone
  checkOutTime?: string | null;
  checkInSource?: string | null;  // PHONE | MACHINE | MANUAL
  checkOutSource?: string | null;
  fieldNote?: string | null;      // employee's "where I am" note
  outLat?: number | null;
  outLng?: number | null;
  outAccuracyMeters?: number | null;
  machineName?: string | null;
  approvalNote?: string | null;
}

// --- Office fingerprint machines (ZKTeco / eSSL, ADMS push) ---------------------------------
export interface AttendanceMachine {
  id: number;
  serialNumber: string;
  name: string;
  officeLocationId: number | null;
  officeLocationName: string | null;
  timeZone: string;
  active: boolean;
  useInOutKeys: boolean;
  allowedIp: string | null;
  model: string | null;
  pushVersion: string | null;
  lastSeenAt: string | null;
  lastIp: string | null;
  lastPunchAt: string | null;
  online: boolean;
  punchesToday?: number;
}

export interface MachineInput {
  serialNumber: string;
  name: string;
  officeLocationId?: number | null;
  timeZone?: string;
  active?: boolean;
  useInOutKeys?: boolean;
  allowedIp?: string | null;
  model?: string | null;
}

export interface MachineConnectionRequest {
  id: number;
  serialNumber: string;
  lastIp: string | null;
  pushVersion: string | null;
  attempts: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface UnmatchedMachineId {
  machinePin: string;
  punches: number;
  firstPunchAt: string | null;
  lastPunchAt: string | null;
}

export interface MachinePunchRow {
  id: number;
  machineId: number;
  machineName: string;
  machinePin: string;
  employeeId: number | null;
  employeeName: string | null;
  punchTime: string;
  verifyMethod: string | null; // FINGER | FACE | CARD | PASSWORD | OTHER
  statusCode: number | null;
  result: string; // USED | DUPLICATE_TAP | UNMATCHED | AFTER_CORRECTION | IGNORED | OUT_OF_RANGE | PENDING
  receivedAt: string | null;
}

// --- Attendance phone binding (one approved phone per login) ---------------------------------
export type DeviceBindingMode = 'OFF' | 'SOFT' | 'HARD';
export type UserDeviceStatus = 'PENDING' | 'ACTIVE' | 'REVOKED' | 'REPLACED' | 'REJECTED';

export interface AdminDevice {
  id: number;
  deviceUuid: string;
  deviceLabel: string | null;
  platform: string | null;
  status: UserDeviceStatus;
  requestReason: string | null;
  requestedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  lastSeenAt: string | null;
}

/** A phone waiting for HR approval, with the phone(s) it would replace. */
export interface DeviceRequest extends AdminDevice {
  userId: number;
  userName: string;
  userEmail: string;
  employeeId: number | null;
  userAgent: string | null;
  lastIp: string | null;
  currentDevices: AdminDevice[];
}

export interface DeviceEvent {
  id: number;
  deviceId: number | null;
  event: string;
  actor: string | null;
  ip: string | null;
  details: string | null;
  at: string | null;
}

export interface EmployeeDevices {
  userId: number | null; // null → employee has no portal login yet
  name?: string;
  email?: string;
  employeeId: number | null;
  modeOverride: DeviceBindingMode | null;
  effectiveMode: DeviceBindingMode;
  devices: AdminDevice[];
  events: DeviceEvent[];
}

export interface MethodRequest {
  employeeId: number;
  employeeCode: string | null;
  employeeName: string;
  currentMethod: string | null;
  requestedMethod: string | null;
  requestedAt: string | null;
}

export interface CorrectionRequest {
  id: number;
  employeeId: number | null;
  employeeName: string;
  employeeCode: string | null;
  date: string | null;
  type: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  originalCheckIn: string | null;
  originalCheckOut: string | null;
  reason: string | null;
  status: string | null;
}

const BASE = '/hr/attendance';

export const attendanceApi = {
  listLocations: () => api.get<AttendanceLocation[]>(`${BASE}/locations`).then((r) => r.data),
  saveLocation: (loc: AttendanceLocation) => api.post<AttendanceLocation>(`${BASE}/locations`, loc).then((r) => r.data),
  deleteLocation: (id: number) => api.delete(`${BASE}/locations/${id}`).then((r) => r.data),
  listPending: () => api.get<PendingAttendance[]>(`${BASE}/pending`).then((r) => r.data),
  approve: (sessionId: number) => api.post<PendingAttendance>(`${BASE}/sessions/${sessionId}/approve`).then((r) => r.data),
  reject: (sessionId: number, reason?: string) =>
    api.post<PendingAttendance>(`${BASE}/sessions/${sessionId}/reject`, { reason }).then((r) => r.data),
  approveMany: (sessionIds: number[]) =>
    api.post<{ approved: number }>(`${BASE}/sessions/approve-many`, { sessionIds }).then((r) => r.data),
  pendingCount: () => api.get<{ count: number }>(`${BASE}/pending/count`).then((r) => r.data.count),

  // Fingerprint machines
  listMachines: () => api.get<AttendanceMachine[]>(`${BASE}/machines`).then((r) => r.data),
  createMachine: (body: MachineInput) => api.post<AttendanceMachine>(`${BASE}/machines`, body).then((r) => r.data),
  updateMachine: (id: number, body: MachineInput) => api.put<AttendanceMachine>(`${BASE}/machines/${id}`, body).then((r) => r.data),
  deleteMachine: (id: number) => api.delete(`${BASE}/machines/${id}`).then((r) => r.data),
  machineConnectionRequests: () =>
    api.get<MachineConnectionRequest[]>(`${BASE}/machines/connection-requests`).then((r) => r.data),
  dismissMachineRequest: (id: number) => api.post(`${BASE}/machines/connection-requests/${id}/dismiss`).then((r) => r.data),
  unmatchedMachineIds: () => api.get<UnmatchedMachineId[]>(`${BASE}/machines/unmatched`).then((r) => r.data),
  setMachinePin: (employeeId: number, machinePin: string) =>
    api.put<{ employeeId: number; machinePin: string; linkedPunches: number }>(
      `${BASE}/machines/employees/${employeeId}/pin`, { machinePin }).then((r) => r.data),
  machinePunches: (params: { machineId?: number; employeeId?: number; from?: string; to?: string; limit?: number }) =>
    api.get<MachinePunchRow[]>(`${BASE}/machines/punches`, { params }).then((r) => r.data),
  reprocessMachinePunches: (employeeId: number, from: string, to: string) =>
    api.post(`${BASE}/machines/reprocess`, { employeeId: String(employeeId), from, to }).then((r) => r.data),

  listMethodRequests: () => api.get<MethodRequest[]>(`${BASE}/method-requests`).then((r) => r.data),
  approveMethodRequest: (employeeId: number) => api.post(`${BASE}/method-requests/${employeeId}/approve`).then((r) => r.data),
  rejectMethodRequest: (employeeId: number) => api.post(`${BASE}/method-requests/${employeeId}/reject`).then((r) => r.data),

  listCorrections: () => api.get<CorrectionRequest[]>(`${BASE}/corrections`).then((r) => r.data),
  approveCorrection: (id: number) => api.post(`${BASE}/corrections/${id}/approve`).then((r) => r.data),
  rejectCorrection: (id: number, remarks?: string) => api.post(`${BASE}/corrections/${id}/reject`, { remarks }).then((r) => r.data),
  applyCorrection: (body: { employeeId: number; date: string; checkIn?: string; checkOut?: string }) =>
    api.post(`${BASE}/corrections/apply`, body).then((r) => r.data),

  // Phone binding
  listDeviceRequests: () => api.get<DeviceRequest[]>(`${BASE}/devices`).then((r) => r.data),
  employeeDevices: (employeeId: number) => api.get<EmployeeDevices>(`${BASE}/devices/employee/${employeeId}`).then((r) => r.data),
  approveDevice: (id: number) => api.post(`${BASE}/devices/${id}/approve`).then((r) => r.data),
  rejectDevice: (id: number, reason?: string) => api.post(`${BASE}/devices/${id}/reject`, { reason }).then((r) => r.data),
  revokeDevice: (id: number, reason?: string) => api.post(`${BASE}/devices/${id}/revoke`, { reason }).then((r) => r.data),
  resetDevices: (userId: number) => api.post<EmployeeDevices>(`${BASE}/devices/user/${userId}/reset`).then((r) => r.data),
  setDeviceMode: (employeeId: number, mode: DeviceBindingMode | 'DEFAULT') =>
    api.put<{ employeeId: number; modeOverride: string; effectiveMode: DeviceBindingMode }>(`${BASE}/devices/employee/${employeeId}/mode`, { mode }).then((r) => r.data),

  // Employee master list for the admin direct-correction picker (paginated endpoint, grab a big page).
  listEmployees: () =>
    api.get<{ content: { id: number; firstName: string; lastName: string; employeeCode: string }[] }>(
      `/hr/employees?page=0&size=500`).then((r) => r.data.content ?? []),
};
