import api from '../lib/api';
import type { PageResp } from '../types/finance';

// Bundle tracking — stickered bundles of customer material that need work (stitching / making).
// Thin typed wrapper around /api/bundles.

export const BUNDLE_FLOW = ['RECEIVED', 'CUTTING', 'STITCHING', 'QC_CHECK', 'PACKED', 'READY', 'DELIVERED'] as const;
export type BundleStatus = (typeof BUNDLE_FLOW)[number] | 'ON_HOLD' | 'CANCELLED';

export const BUNDLE_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  QC_CHECK: 'QC Check',
  PACKED: 'Packed',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled',
};

/** Pill colours per status (premium theme remaps these families centrally). */
export const BUNDLE_STATUS_STYLES: Record<string, string> = {
  RECEIVED: 'bg-slate-100 text-slate-700 border-slate-200',
  CUTTING: 'bg-sky-50 text-sky-700 border-sky-200',
  STITCHING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  QC_CHECK: 'bg-violet-50 text-violet-700 border-violet-200',
  PACKED: 'bg-amber-50 text-amber-800 border-amber-200',
  READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DELIVERED: 'bg-emerald-600 text-white border-emerald-600',
  ON_HOLD: 'bg-orange-50 text-orange-700 border-orange-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
};

/** Action label for moving INTO a status ("Start stitching", "Mark packed" …). */
export const BUNDLE_NEXT_ACTION: Record<string, string> = {
  CUTTING: 'Start cutting',
  STITCHING: 'Start stitching',
  QC_CHECK: 'Send to QC',
  PACKED: 'Mark packed',
  READY: 'Mark ready',
  DELIVERED: 'Hand over',
};

export const WORK_TYPES = [
  { v: 'STITCHING', label: 'Stitching' },
  { v: 'MAKING', label: 'Making' },
  { v: 'FITTING', label: 'Fitting' },
  { v: 'OTHER', label: 'Other work' },
];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export interface BundleItem {
  id: number;
  invoiceItemId?: number | null;
  productId?: number | null;
  description: string;
  quantity: number;
  unit?: string | null;
  workSpec?: string | null;
  notes?: string | null;
  photoUrls?: string | null;
  done: boolean;
}

export interface BundleEvent {
  id: number;
  fromStatus?: string | null;
  toStatus: string;
  userName?: string | null;
  note?: string | null;
  photoUrl?: string | null;
  at: string;
}

export interface BundleSibling { id: number; code: string; bundleNo: number; status: string }

export interface Bundle {
  id: number;
  code: string;
  groupCode: string;
  bundleNo: number;
  bundleTotal: number;
  status: BundleStatus;
  nextStatus?: string | null;
  heldFromStatus?: string | null;
  holdReason?: string | null;
  workType: string;
  resourceType?: string | null;
  resourceId?: number | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  overdue: boolean;
  priority: string;
  handoverMode: 'PICKUP' | 'DELIVERY';
  rackLocation?: string | null;
  notes?: string | null;
  packedAt?: string | null;
  deliveredAt?: string | null;
  deliveredTo?: string | null;
  createdAt?: string | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  invoiceStatus?: string | null;
  invoiceTotal?: number | null;
  amountPaid?: number | null;
  /** Still owed on the bill (live) — 0 when paid or there is no bill. */
  balanceDue?: number | null;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  itemCount: number;
  totalQuantity: number;
  items?: BundleItem[];
  events?: BundleEvent[];
  siblings?: BundleSibling[];
}

export interface BundleSummary {
  byStatus: Record<string, number>;
  open: number;
  overdue: number;
  ready: number;
  onHold: number;
  inWork: number;
}

export interface BundleItemSpecInput {
  invoiceItemId?: number | null;
  productId?: number | null;
  description?: string;
  quantity?: number;
  unit?: string | null;
  workSpec?: string | null;
  notes?: string | null;
}

export interface CreateBundlesInput {
  invoiceId?: number | null;
  customerId?: number | null;
  workType?: string;
  dueDate?: string | null;
  priority?: string;
  resourceType?: string | null;
  resourceId?: number | null;
  handoverMode?: string;
  rackLocation?: string | null;
  notes?: string | null;
  bundles: { items: BundleItemSpecInput[] }[];
}

export interface HandoverInput {
  bundleIds: number[];
  deliveredTo?: string;
  note?: string;
  photoUrl?: string;
  payments?: { method: string; amount: number; referenceNumber?: string }[];
  /** Manager only: hand over although a balance is still due (needs a note). */
  allowBalanceDue?: boolean;
}

const qs = (params: Record<string, unknown>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) query.set(k, String(v));
  });
  const s = query.toString();
  return s ? `?${s}` : '';
};

export const bundleApi = {
  search: (p: { status?: string; overdue?: boolean; openOnly?: boolean; q?: string; resourceType?: string; resourceId?: number; page?: number; size?: number } = {}) =>
    api.get<PageResp<Bundle>>(`/bundles${qs({ page: 0, size: 100, ...p })}`).then((r) => r.data),
  summary: () => api.get<BundleSummary>('/bundles/summary').then((r) => r.data),
  byCode: (code: string) => api.get<Bundle>(`/bundles/code/${encodeURIComponent(code.trim())}`).then((r) => r.data),
  /** Scan box: bundle code, group code or bill number → matching bundles. */
  lookup: (q: string) => api.get<Bundle[]>(`/bundles/lookup${qs({ q: q.trim() })}`).then((r) => r.data),
  handover: (body: HandoverInput) => api.post<Bundle[]>('/bundles/handover', body).then((r) => r.data),
  get: (id: number) => api.get<Bundle>(`/bundles/${id}`).then((r) => r.data),
  forInvoice: (invoiceId: number) => api.get<Bundle[]>(`/bundles/invoice/${invoiceId}`).then((r) => r.data),
  create: (body: CreateBundlesInput) => api.post<Bundle[]>('/bundles', body).then((r) => r.data),
  move: (id: number, body: { status: string; note?: string; photoUrl?: string; deliveredTo?: string }) =>
    api.put<Bundle>(`/bundles/${id}/status`, body).then((r) => r.data),
  hold: (id: number, reason: string) => api.post<Bundle>(`/bundles/${id}/hold`, { reason }).then((r) => r.data),
  release: (id: number) => api.post<Bundle>(`/bundles/${id}/release`).then((r) => r.data),
  assign: (id: number, resourceType: string | null, resourceId: number | null) =>
    api.put<Bundle>(`/bundles/${id}/assign`, { resourceType, resourceId }).then((r) => r.data),
  update: (id: number, body: Record<string, unknown>) => api.put<Bundle>(`/bundles/${id}`, body).then((r) => r.data),
};

/**
 * Pull a bundle code out of whatever a scanner produced: a plain code from a USB barcode scanner
 * ("JB-0042-1"), or the sticker QR's deep link (".../bundles/code/JB-0042-1").
 */
export function extractBundleCode(raw: string): string {
  const s = (raw || '').trim();
  const m = s.match(/bundles\/code\/([^/?#\s]+)/i);
  return decodeURIComponent(m ? m[1] : s).trim().toUpperCase();
}
