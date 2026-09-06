import api from '../lib/api';

// Admin-side view of employee self-service change requests (profile fields + documents).
// These hit /api/hr/** and return the raw entity (not ApiResponse-wrapped), so `.data` is the list.

export interface AdminProfileChangeRequest {
  id: number;
  changeType: 'PROFILE' | 'DOCUMENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  proposedPhone: string | null;
  proposedEmergencyName: string | null;
  proposedEmergencyPhone: string | null;
  proposedPhotoUrl: string | null;
  docName: string | null;
  docType: string | null;
  docFileUrl: string | null;
  reviewRemarks: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  employee?: { id: number; firstName: string; lastName: string; employeeCode: string; email: string } | null;
  requestedBy?: { id: number; name: string } | null;
}

export const profileApprovalsApi = {
  list: (status = 'PENDING') =>
    api.get<AdminProfileChangeRequest[]>(`/hr/profile-change-requests`, { params: { status } }).then((r) => r.data),
  forEmployee: (employeeId: number) =>
    api.get<AdminProfileChangeRequest[]>(`/hr/employees/${employeeId}/profile-change-requests`).then((r) => r.data),
  approve: (id: number) =>
    api.post<AdminProfileChangeRequest>(`/hr/profile-change-requests/${id}/approve`).then((r) => r.data),
  reject: (id: number, remarks?: string) =>
    api.post<AdminProfileChangeRequest>(`/hr/profile-change-requests/${id}/reject`, { remarks }).then((r) => r.data),
};
