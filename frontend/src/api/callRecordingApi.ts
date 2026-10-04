import api from "@/lib/api";
import type { LeadCreateBody } from "@/types/employeePortal";

export type CallOutcome = "LEAD_CREATED" | "ADDED_TO_LEAD" | "NOT_A_LEAD";
export type CallStatus = "NEW" | "TASK_CREATED" | "DONE" | "DISCARDED";

export interface LeadRef { id: number; leadNumber: string; name: string; status?: string }

export interface CallRecording {
  id: number;
  fileUrl: string;
  fileName: string;
  sizeBytes?: number | null;
  durationSec?: number | null;
  phoneNumber?: string | null;
  calledAt?: string | null;
  direction?: "IN" | "OUT" | null;
  contactName?: string | null;
  note?: string | null;
  status: CallStatus;
  outcome?: CallOutcome | null;
  outcomeReason?: string | null;
  outcomeAt?: string | null;
  outcomeBy?: string | null;
  createdAt?: string | null;
  uploadedBy?: string | null;
  taskId?: number | null;
  taskStatus?: string | null;
  taskName?: string | null;
  dueDate?: string | null;
  assigneeName?: string | null;
  matchedLead?: LeadRef | null;
  lead?: LeadRef | null;
}

export interface CallTaskRequest {
  ids: number[];
  resourceType: string;
  resourceId: number;
  dueDate?: string;
  priority?: string;
}

const BASE = "/call-recordings";

export const callRecordingApi = {
  list: () => api.get<CallRecording[]>(BASE).then((r) => r.data),

  /** One file per request so each row gets its own progress and error. */
  upload: (file: File, extra: { lastModified?: number; durationSec?: number }, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append("file", file);
    if (extra.lastModified) fd.append("lastModified", String(extra.lastModified));
    if (extra.durationSec) fd.append("durationSec", String(extra.durationSec));
    return api.post<CallRecording>(BASE, fd, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    }).then((r) => r.data);
  },

  update: (id: number, body: Partial<Pick<CallRecording, "phoneNumber" | "calledAt" | "contactName" | "note">>) =>
    api.put<CallRecording>(`${BASE}/${id}`, body).then((r) => r.data),

  discard: (id: number) => api.delete(`${BASE}/${id}`),

  createTasks: (body: CallTaskRequest) => api.post<CallRecording[]>(`${BASE}/tasks`, body).then((r) => r.data),

  forLead: (leadId: number) => api.get<CallRecording[]>(`${BASE}/by-lead/${leadId}`).then((r) => r.data),

  forTask: (taskId: number) => api.get<CallRecording | null>(`${BASE}/by-task/${taskId}`).then((r) => r.data),

  createLead: (id: number, body: LeadCreateBody) => api.post<CallRecording>(`${BASE}/${id}/lead`, body).then((r) => r.data),

  attachToLead: (id: number, leadId: number, note?: string) =>
    api.post<CallRecording>(`${BASE}/${id}/attach-lead`, { leadId, note }).then((r) => r.data),

  notALead: (id: number, reason: string) => api.post<CallRecording>(`${BASE}/${id}/not-a-lead`, { reason }).then((r) => r.data),
};

/** "3:42" / "1:02:10" from seconds. */
export function fmtDuration(sec?: number | null) {
  if (!sec || sec <= 0) return "—";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "04 Oct 2026, 2:30 PM" */
export function fmtCallTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export function errMsg(e: any, fallback: string) {
  return e?.response?.data?.message || e?.message || fallback;
}
