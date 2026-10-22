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
  checkOutTime?: string | null;
  checkInSource?: string | null;  // PHONE | MANUAL
  checkOutSource?: string | null;
  fieldNote?: string | null;      // employee's "where I am" note
  outLat?: number | null;
  outLng?: number | null;
  outAccuracyMeters?: number | null;
  approvalNote?: string | null;
  flagged?: boolean;
  // Office-kiosk evidence (null for phone / HR punches)
  kioskName?: string | null;
  selfieInUrl?: string | null;
  selfieOutUrl?: string | null;
  faceDistanceIn?: number | null;   // lower = closer match
  faceDistanceOut?: number | null;
  livenessIn?: string | null;       // BLINK | TURN
  livenessOut?: string | null;
  fingerScoreIn?: number | null;    // higher = closer match
  fingerScoreOut?: number | null;
}

export type KioskVerifyMode = 'FACE' | 'FINGER' | 'EITHER';

// --- Office kiosks (shared face-attendance phone) ---------------------------------------------
export interface AttendanceKioskRow {
  id: number;
  name: string;
  officeLocationId: number | null;
  officeLocationName: string | null;
  active: boolean;
  verifyMode: KioskVerifyMode;
  paired: boolean;
  pairedAt: string | null;
  deviceInfo: string | null;
  lastSeenAt: string | null;
  lastIp: string | null;
  online: boolean;
  waitingForPairing: boolean;
  pairingExpiresAt: string | null;
  /** Present only in the response to create / re-pair. */
  pairingCode: string | null;
}

// --- Face enrolment for the office kiosk -------------------------------------------------------
export interface FaceStatus {
  enrolled: boolean;
  samples: number;
  enrolledAt: string | null;
  photoUrl: string | null;
  enrolledBy: string | null;
}

// --- Fingerprint enrolment for the office kiosk ------------------------------------------------
export interface FingerprintStatus {
  enrolled: boolean;
  fingers: { finger: number; name: string; samples: number }[];
  enrolledAt: string | null;
  consentAt: string | null;
  enrolledBy: string | null;
}

/** One sensor capture as the kiosk app returns it: an image (PNG/JPEG/RAW grayscale) or an ISO template, base64. */
export interface FingerCapture {
  format: 'PNG' | 'JPEG' | 'BMP' | 'RAW' | 'ISO';
  width?: number;
  height?: number;
  dpi?: number;
  data: string;
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

  // Office kiosks
  listKiosks: () => api.get<AttendanceKioskRow[]>(`${BASE}/kiosks`).then((r) => r.data),
  createKiosk: (body: { name: string; officeLocationId?: number | null }) =>
    api.post<AttendanceKioskRow>(`${BASE}/kiosks`, body).then((r) => r.data),
  updateKiosk: (id: number, body: { name?: string; officeLocationId?: number | null; active?: boolean; verifyMode?: KioskVerifyMode }) =>
    api.put<AttendanceKioskRow>(`${BASE}/kiosks/${id}`, body).then((r) => r.data),
  repairKiosk: (id: number) => api.post<AttendanceKioskRow>(`${BASE}/kiosks/${id}/repair`).then((r) => r.data),
  deleteKiosk: (id: number) => api.delete(`${BASE}/kiosks/${id}`).then((r) => r.data),

  kioskLog: (params: { from?: string; to?: string; employeeId?: number; limit?: number }) =>
    api.get<PendingAttendance[]>(`${BASE}/kiosk-log`, { params }).then((r) => r.data),

  // Face enrolment
  faceSummary: () => api.get<Record<number, { samples: number; enrolledAt: string | null }>>(`${BASE}/faces`).then((r) => r.data),
  faceStatus: (employeeId: number) => api.get<FaceStatus>(`${BASE}/faces/employees/${employeeId}`).then((r) => r.data),
  enrollFace: (employeeId: number, body: { descriptors: number[][]; qualities?: number[]; photoUrl?: string }) =>
    api.put<FaceStatus>(`${BASE}/faces/employees/${employeeId}`, body).then((r) => r.data),
  removeFace: (employeeId: number) => api.delete(`${BASE}/faces/employees/${employeeId}`).then((r) => r.data),

  // Fingerprint enrolment
  fingerprintSummary: () => api.get<Record<number, { fingers: number; enrolledAt: string | null }>>(`${BASE}/fingerprints`).then((r) => r.data),
  fingerprintStatus: (employeeId: number) => api.get<FingerprintStatus>(`${BASE}/fingerprints/employees/${employeeId}`).then((r) => r.data),
  enrollFingerprint: (employeeId: number, finger: number, body: { consent: boolean; captures: FingerCapture[] }) =>
    api.put<FingerprintStatus>(`${BASE}/fingerprints/employees/${employeeId}/fingers/${finger}`, body).then((r) => r.data),
  removeFingerprint: (employeeId: number, finger?: number) =>
    api.delete(finger == null ? `${BASE}/fingerprints/employees/${employeeId}` : `${BASE}/fingerprints/employees/${employeeId}/fingers/${finger}`).then((r) => r.data),

  listMethodRequests: () => api.get<MethodRequest[]>(`${BASE}/method-requests`).then((r) => r.data),
  approveMethodRequest: (employeeId: number) => api.post(`${BASE}/method-requests/${employeeId}/approve`).then((r) => r.data),
  rejectMethodRequest: (employeeId: number) => api.post(`${BASE}/method-requests/${employeeId}/reject`).then((r) => r.data),

  listCorrections: () => api.get<CorrectionRequest[]>(`${BASE}/corrections`).then((r) => r.data),
  approveCorrection: (id: number) => api.post(`${BASE}/corrections/${id}/approve`).then((r) => r.data),
  rejectCorrection: (id: number, remarks?: string) => api.post(`${BASE}/corrections/${id}/reject`, { remarks }).then((r) => r.data),
  applyCorrection: (body: { employeeId: number; date: string; checkIn?: string; checkOut?: string }) =>
    api.post(`${BASE}/corrections/apply`, body).then((r) => r.data),

  /** Set ALL of a day's sessions: ones with an id are edited, ones without are added, missing ones are removed. */
  applySessions: (body: { employeeId: number; date: string; sessions: { id?: number; checkIn: string; checkOut?: string }[] }) =>
    api.post(`${BASE}/corrections/apply-sessions`, body).then((r) => r.data),

  // Phone binding

  // Employee master list for the admin direct-correction picker (paginated endpoint, grab a big page).
  listEmployees: () =>
    api.get<{ content: { id: number; firstName: string; lastName: string; employeeCode: string }[] }>(
      `/hr/employees?page=0&size=500`).then((r) => r.data.content ?? []),
};
