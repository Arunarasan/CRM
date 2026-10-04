import api from '@/lib/api';

// One file on a project, from any source — see GET /api/projects/{id}/files (ProjectFilesService).
export type FileKind = 'image' | 'pdf' | 'video' | 'audio' | 'cad' | 'sheet' | 'doc' | 'file';
export type FileCategory = 'PHOTO' | 'DRAWING' | 'DOCUMENT' | 'AGREEMENT' | 'BILL' | 'VIDEO' | 'AUDIO';

export interface ProjectFile {
  key: string;
  source: string;
  sourceLabel: string;
  type: string;
  kind: FileKind;
  category: FileCategory;
  fileName: string;
  fileUrl: string;
  description?: string | null;
  addedBy?: string | null;
  addedAt?: string | null;
  link?: string | null;
  editable: boolean;
  generated: boolean;
  docId?: number;
}

export interface ProjectFilesResponse {
  files: ProjectFile[];
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  total: number;
}

export const projectFilesApi = {
  list: (projectId: number) => api.get<ProjectFilesResponse>(`/projects/${projectId}/files`).then((r) => r.data),
  add: (projectId: number, body: { fileName: string; fileUrl: string; documentType: string; remarks?: string }) =>
    api.post(`/projects/${projectId}/documents`, body).then((r) => r.data),
  update: (docId: number, body: { fileName?: string; documentType?: string; remarks?: string }) =>
    api.put(`/projects/documents/${docId}`, body).then((r) => r.data),
  remove: (docId: number) => api.delete(`/projects/documents/${docId}`),
  replaceFile: (docId: number, body: { fileUrl: string; fileName?: string }) =>
    api.put(`/projects/documents/${docId}/file`, body).then((r) => r.data),
};

/** Categories in display order. */
export const CATEGORIES: { id: FileCategory; label: string }[] = [
  { id: 'PHOTO', label: 'Photos' },
  { id: 'DRAWING', label: 'Drawings' },
  { id: 'DOCUMENT', label: 'Documents' },
  { id: 'AGREEMENT', label: 'Agreements & approvals' },
  { id: 'BILL', label: 'Bills & invoices' },
  { id: 'VIDEO', label: 'Videos' },
  { id: 'AUDIO', label: 'Voice notes' },
];

export const SOURCES: Record<string, string> = {
  PROJECT: 'Uploaded here',
  LEAD: 'Lead',
  MEASUREMENT: 'Measurement',
  SITE_VISIT: 'Site visit',
  QUOTATION: 'Quotation',
  INVOICE: 'Billing',
  TASK: 'Tasks',
  CHAT: 'Team chat',
  DAILY_LOG: 'Daily logs',
  DAILY_REPORT: 'Daily reports',
  WORK_STEP: 'Execution',
  GRN: 'Goods received',
  HANDOVER: 'Handover',
  CONTRACTOR: 'Contractor',
};

/** What a new upload can be — "What is this?" in the add sheet. */
export const UPLOAD_TYPES = [
  'Site photo', 'Design / reference', 'Floor plan', 'Drawing', 'CAD', 'Agreement', 'Approval',
  'Invoice', 'PO', 'Receipt', 'BOQ', 'Warranty', 'Video', 'Voice note', 'Other',
];

/** A sensible "What is this?" guess from the picked file. */
export function guessType(file: File): string {
  const n = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return 'Site photo';
  if (file.type.startsWith('video/')) return 'Video';
  if (file.type.startsWith('audio/')) return 'Voice note';
  if (/\.(dwg|dxf|skp|rvt)$/.test(n)) return 'CAD';
  if (/invoice|bill/.test(n)) return 'Invoice';
  if (/agreement|contract/.test(n)) return 'Agreement';
  if (/plan|layout/.test(n)) return 'Floor plan';
  return 'Other';
}

export function kindOfFile(file: File): FileKind {
  const n = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (n.endsWith('.pdf')) return 'pdf';
  if (/\.(dwg|dxf|skp|rvt)$/.test(n)) return 'cad';
  if (/\.(xls|xlsx|csv)$/.test(n)) return 'sheet';
  if (/\.(doc|docx|txt|rtf|odt)$/.test(n)) return 'doc';
  return 'file';
}

export const fmtWhen = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const extOf = (name?: string | null) => {
  const m = (name || '').match(/\.([a-z0-9]{1,5})(?:$|\?)/i);
  return m ? m[1].toUpperCase() : 'FILE';
};
