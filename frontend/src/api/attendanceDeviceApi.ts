import api from '@/lib/api';

// Biometric attendance terminals, enrollment, shifts, branches and attendance insights.
// Endpoints return raw payloads (no ApiResponse envelope), so r.data is the value.

export type DeviceStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'REVOKED' | 'REJECTED' | 'OFFLINE';

export interface AttendanceDevice {
  id: number;
  deviceName: string;
  deviceCode: string;
  deviceUuid: string | null;
  status: DeviceStatus;
  /** ACTIVE devices with no recent heartbeat show as OFFLINE. */
  effectiveStatus: DeviceStatus;
  online: boolean;
  branchId: number | null;
  branchName: string | null;
  locationId: number | null;
  locationName: string | null;
  lastSeenAt: string | null;
  appVersion: string | null;
  scannerStatus: string | null;
  scannerVendor: string | null;
  scannerModel: string | null;
  scannerSerial: string | null;
  registeredAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  lastSyncAt: string | null;
  pendingSyncCount: number | null;
  manufacturer: string | null;
  model: string | null;
  osVersion: string | null;
  lastIp: string | null;
  statusReason: string | null;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  enrolledCount: number;
  awaitingPairing: boolean;
  pairingExpiresAt: string | null;
  credentialIssuedAt: string | null;
}

export interface DeviceEvent {
  id: number;
  eventType: string;
  message: string | null;
  employeeId: number | null;
  employeeName: string | null;
  actor: string | null;
  ipAddress: string | null;
  occurredAt: string;
}

export interface PairingResponse {
  device: AttendanceDevice;
  pairingCode: string;
  pairingExpiresAt: string;
}

export interface Branch {
  id?: number;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  active: boolean;
}

export interface Shift {
  id?: number;
  name: string;
  startTime: string; // HH:mm[:ss]
  endTime: string;
  gracePeriodMinutes: number;
  breakMinutes: number;
  workingHours?: number;
  overtimeEnabled: boolean;
  halfDayThresholdMinutes: number;
  weekOffDays: string; // CSV of MONDAY…SUNDAY
  defaultShift: boolean;
  active: boolean;
  employeeCount?: number;
}

export interface DashboardRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  branch: string | null;
  shift: string | null;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workingMinutes: number | null;
  lateMinutes: number | null;
  earlyDepartureMinutes: number | null;
  overtimeMinutes: number | null;
  checkInMethod: string | null;
  checkOutMethod: string | null;
  biometricVerified: boolean;
  device: string | null;
  deviceId: number | null;
  enrolled: boolean;
  checkedInNow: boolean;
  remarks: string | null;
}

export interface Dashboard {
  date: string;
  cards: {
    total: number; present: number; late: number; absent: number; onLeave: number; halfDay: number;
    weekOff: number; notMarked: number; checkedInNow: number; biometric: number;
  };
  devices: { active: number; online: number; pendingSync: number };
  rows: DashboardRow[];
}

export interface HistoryDay {
  date: string;
  dayOfWeek: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workingMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  method: string | null;
  biometricVerified: boolean;
  remarks: string | null;
}

export interface History {
  employeeId: number;
  employeeName: string;
  year: number;
  month: number;
  shift: { id: number; name: string; startTime: string; endTime: string } | null;
  summary: {
    workingDays: number; present: number; absent: number; leave: number; halfDay: number; late: number;
    weekOff: number; holiday: number; overtimeMinutes: number; workedMinutes: number; lateMinutes: number;
  };
  days: HistoryDay[];
}

export interface ReportRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  branch: string | null;
  shift: string | null;
  workingDays: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  halfDay: number;
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
}

export interface BiometricEnrollment {
  id: number;
  status: 'ACTIVE' | 'REVOKED';
  fingerPosition: string | null;
  qualityScore: number | null;
  provider: string;
  deviceId: number | null;
  deviceName: string | null;
  enrolledBy: string | null;
  enrolledAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
}

export interface EnrollmentSession {
  id: number;
  employeeId: number;
  deviceId: number;
  deviceName: string;
  fingerPosition: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  requestedBy: string | null;
  createdAt: string | null;
  expiresAt: string;
  completedAt: string | null;
  failureReason: string | null;
}

export interface BiometricStatus {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  enrolled: boolean;
  enrollments: BiometricEnrollment[];
  sessions: EnrollmentSession[];
  devices: { id: number; deviceName: string; deviceCode: string; branchName: string | null; scannerStatus: string | null; lastSeenAt: string | null }[];
  branchId: number | null;
  branchName: string | null;
  shiftId: number | null;
  shiftName: string | null;
  attendanceRequired: boolean;
}

export interface AttendanceFilters {
  date?: string;
  employeeId?: number;
  departmentId?: number;
  branchId?: number;
  shiftId?: number;
  deviceId?: number;
  status?: string;
}

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

const DEV = '/hr/attendance-devices';

export const attendanceDeviceApi = {
  // devices
  list: () => api.get<AttendanceDevice[]>(DEV).then((r) => r.data),
  get: (id: number) => api.get<AttendanceDevice>(`${DEV}/${id}`).then((r) => r.data),
  register: (body: { deviceName: string; branchId: number; locationId: number }) =>
    api.post<PairingResponse>(DEV, body).then((r) => r.data),
  newPairingCode: (id: number) => api.post<PairingResponse>(`${DEV}/${id}/pairing-code`).then((r) => r.data),
  update: (id: number, body: { deviceName?: string; branchId?: number; locationId?: number }) =>
    api.put<AttendanceDevice>(`${DEV}/${id}`, body).then((r) => r.data),
  approve: (id: number, body?: { deviceName?: string; branchId?: number; locationId?: number }) =>
    api.post<AttendanceDevice>(`${DEV}/${id}/approve`, body ?? {}).then((r) => r.data),
  reject: (id: number, reason?: string) => api.post<AttendanceDevice>(`${DEV}/${id}/reject`, { reason }).then((r) => r.data),
  block: (id: number, reason?: string) => api.post<AttendanceDevice>(`${DEV}/${id}/block`, { reason }).then((r) => r.data),
  unblock: (id: number) => api.post<AttendanceDevice>(`${DEV}/${id}/unblock`).then((r) => r.data),
  revoke: (id: number, reason?: string) => api.post<AttendanceDevice>(`${DEV}/${id}/revoke`, { reason }).then((r) => r.data),
  remove: (id: number) => api.delete(`${DEV}/${id}`).then((r) => r.data),
  activity: (id: number, limit = 100) => api.get<DeviceEvent[]>(`${DEV}/${id}/activity`, { params: { limit } }).then((r) => r.data),

  // biometric
  biometricStatus: (employeeId: number) => api.get<BiometricStatus>(`/hr/biometric/${employeeId}/status`).then((r) => r.data),
  startEnrollment: (employeeId: number, deviceId: number, fingerPosition: string) =>
    api.post<EnrollmentSession>('/hr/biometric/enroll', { employeeId, deviceId, fingerPosition }).then((r) => r.data),
  enrollmentSession: (id: number) => api.get<EnrollmentSession>(`/hr/biometric/sessions/${id}`).then((r) => r.data),
  cancelEnrollment: (id: number) => api.post<EnrollmentSession>(`/hr/biometric/sessions/${id}/cancel`).then((r) => r.data),
  removeAllBiometrics: (employeeId: number, reason?: string) =>
    api.delete<{ revoked: number }>(`/hr/biometric/${employeeId}`, { data: { reason } }).then((r) => r.data),
  removeEnrollment: (biometricId: number) => api.delete(`/hr/biometric/enrollments/${biometricId}`).then((r) => r.data),

  // insights
  dashboard: (f: AttendanceFilters) => api.get<Dashboard>('/hr/attendance/dashboard', { params: clean({ ...f }) }).then((r) => r.data),
  history: (employeeId: number, year: number, month: number) =>
    api.get<History>('/hr/attendance/history', { params: { employeeId, year, month } }).then((r) => r.data),
  report: (from: string, to: string, f: AttendanceFilters) =>
    api.get<{ from: string; to: string; rows: ReportRow[]; totals: Record<string, number> }>('/hr/attendance/report', {
      params: clean({ from, to, ...f, date: undefined }),
    }).then((r) => r.data),

  // shifts & assignment
  shifts: () => api.get<Shift[]>('/hr/attendance/shifts').then((r) => r.data),
  saveShift: (s: Shift) => api.post<Shift>('/hr/attendance/shifts', s).then((r) => r.data),
  deleteShift: (id: number) => api.delete(`/hr/attendance/shifts/${id}`).then((r) => r.data),
  assign: (body: { employeeIds: number[]; shiftId?: number; branchId?: number; useDefaultShift?: boolean }) =>
    api.put<{ updated: number }>('/hr/attendance/assignments', body).then((r) => r.data),

  // branches
  branches: () => api.get<Branch[]>('/hr/branches').then((r) => r.data),
  saveBranch: (b: Branch) => api.post<Branch>('/hr/branches', b).then((r) => r.data),
  deleteBranch: (id: number) => api.delete(`/hr/branches/${id}`).then((r) => r.data),

  // lookups shared by filters
  departments: () => api.get<{ id: number; name: string }[]>('/hr/departments').then((r) => r.data),
  employees: () =>
    api.get<{ content: { id: number; firstName: string; lastName: string; employeeCode: string }[] }>('/hr/employees', {
      params: { page: 0, size: 1000 },
    }).then((r) => r.data.content ?? []),
};

/** "8h 57m" from minutes; "—" when unknown. */
export const fmtMinutes = (m?: number | null) => {
  if (m == null) return '—';
  const v = Math.max(0, Math.round(m));
  return `${Math.floor(v / 60)}h ${String(v % 60).padStart(2, '0')}m`;
};

/** "09:05" from "09:05:12". */
export const fmtClock = (t?: string | null) => (t ? String(t).slice(0, 5) : '—');

/** Relative "30 seconds ago" for last-seen style timestamps. */
export const timeAgo = (iso?: string | null) => {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return `${s} second${s === 1 ? '' : 's'} ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return `${Math.round(h / 24)} days ago`;
};

export const FINGERS = [
  'RIGHT_THUMB', 'RIGHT_INDEX', 'RIGHT_MIDDLE', 'RIGHT_RING', 'RIGHT_LITTLE',
  'LEFT_THUMB', 'LEFT_INDEX', 'LEFT_MIDDLE', 'LEFT_RING', 'LEFT_LITTLE',
];

export const fingerLabel = (f?: string | null) =>
  f ? f.charAt(0) + f.slice(1).toLowerCase().replace('_', ' ') : '—';

/** Attendance status presentation shared by the dashboard, history and calendar. */
export const ATTENDANCE_STATUS: Record<string, { label: string; short: string; pill: string; cell: string }> = {
  PRESENT: { label: 'Present', short: 'P', pill: 'bg-emerald-100 text-emerald-700', cell: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LATE: { label: 'Late', short: 'P', pill: 'bg-amber-100 text-amber-800', cell: 'bg-amber-50 text-amber-800 border-amber-200' },
  HALF_DAY: { label: 'Half day', short: 'HD', pill: 'bg-violet-100 text-violet-700', cell: 'bg-violet-50 text-violet-700 border-violet-200' },
  ABSENT: { label: 'Absent', short: 'A', pill: 'bg-rose-100 text-rose-700', cell: 'bg-rose-50 text-rose-700 border-rose-200' },
  LEAVE: { label: 'On leave', short: 'L', pill: 'bg-sky-100 text-sky-800', cell: 'bg-sky-50 text-sky-800 border-sky-200' },
  WEEK_OFF: { label: 'Week off', short: 'W', pill: 'bg-slate-100 text-slate-500', cell: 'bg-slate-50 text-slate-400 border-slate-200' },
  HOLIDAY: { label: 'Holiday', short: 'H', pill: 'bg-slate-100 text-slate-600', cell: 'bg-slate-50 text-slate-500 border-slate-200' },
  ON_DUTY: { label: 'On duty', short: 'OD', pill: 'bg-teal-100 text-teal-700', cell: 'bg-teal-50 text-teal-700 border-teal-200' },
  WORK_FROM_HOME: { label: 'WFH', short: 'WH', pill: 'bg-teal-100 text-teal-700', cell: 'bg-teal-50 text-teal-700 border-teal-200' },
  NOT_MARKED: { label: 'Not marked', short: '–', pill: 'bg-slate-100 text-slate-500', cell: 'bg-white text-slate-300 border-slate-100' },
};

export const statusMeta = (s?: string | null) =>
  ATTENDANCE_STATUS[s ?? ''] ?? { label: s ?? '—', short: '?', pill: 'bg-slate-100 text-slate-600', cell: 'bg-white text-slate-500 border-slate-200' };

/** Downloads rows as a CSV file (Excel-friendly, UTF-8 BOM). */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
