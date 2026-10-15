import api from '../lib/api';

/**
 * Field employee "Customer Agreed" → admin approval → project (/api/project-requests).
 * The employee sends the agreed quote with the customer's advance (all optional); an admin / project
 * manager approves (project created, advance recorded) or rejects (quote opens again).
 */
export interface ProjectRequest {
  id: number;
  leadId: number;
  leadName?: string;
  boqId?: number | null;
  quotationId?: number | null;
  quotationNumber?: string | null;
  quoteTotal?: number | null;
  advanceAmount?: number | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  proofUrl?: string | null;
  note?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedByName?: string | null;
  requestedAt?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  projectId?: number | null;
}

export interface ProjectRequestPayload {
  advanceAmount?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  proofUrl?: string;
  note?: string;
}

const BASE = '/project-requests';
/** The API answers {} when a lead has no request. */
const orNull = (r: Partial<ProjectRequest>) => (r && r.id ? (r as ProjectRequest) : null);

export const projectRequestApi = {
  send: (leadId: number, payload: ProjectRequestPayload) =>
    api.post<ProjectRequest>(`${BASE}/lead/${leadId}`, payload).then((r) => r.data),
  forLead: (leadId: number | string) =>
    api.get<Partial<ProjectRequest>>(`${BASE}/lead/${leadId}`).then((r) => orNull(r.data)),
  pending: () => api.get<ProjectRequest[]>(`${BASE}/pending`).then((r) => r.data),
  approve: (id: number, payload?: { advanceAmount?: string; paymentMethod?: string }) =>
    api.post<ProjectRequest>(`${BASE}/${id}/approve`, payload ?? {}).then((r) => r.data),
  reject: (id: number, reason: string) =>
    api.post<ProjectRequest>(`${BASE}/${id}/reject`, { reason }).then((r) => r.data),
};
