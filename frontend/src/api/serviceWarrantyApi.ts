import api from '../lib/api';

// Post-completion Service & Warranty for a project. Endpoints return ApiResponse<T>-wrapped bodies,
// auto-unwrapped by the axios interceptor in lib/api.ts.

export interface WarrantyCover {
  months: number | null;
  endDate: string | null;
  inWarranty: boolean;
  daysLeft: number | null;
}

export interface WarrantyInfo {
  activated: boolean;
  startDate: string | null;
  notes: string | null;
  service: WarrantyCover;
  product: WarrantyCover;
}

export interface ServiceWork {
  id: number;
  subject: string;
  issueType: string | null;
  description: string | null;
  priority: string | null;
  status: string;
  origin: string;
  warrantyType: string | null;
  chargeType: string | null;
  chargeAmount: number | null;
  resolutionNotes: string | null;
  preferredDate: string | null;
  createdAt: string;
  taskId: number | null;
  invoiceId: number | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

export interface ServiceWarrantyOverview {
  projectStatus: string;
  completed: boolean;
  warranty: WarrantyInfo;
  defaults: { serviceMonths: number; productMonths: number };
  serviceWorks: ServiceWork[];
}

export interface WarrantyActivateBody {
  startDate?: string;
  serviceMonths?: number;
  productMonths?: number;
  notes?: string;
}

export interface ServiceWorkBody {
  subject?: string;
  issueType?: string;
  description?: string;
  priority?: string;
  preferredDate?: string;
  warrantyType?: string | null;
  chargeType?: string | null;
  chargeAmount?: number | null;
  status?: string;
  resolutionNotes?: string;
}

export interface RaiseInvoiceBody {
  chargeAmount?: number;
  gstRate?: number;
  gstType?: string;
  collectNow?: boolean;
  paymentMethod?: string;
}

const BASE = '/projects';

export const serviceWarrantyApi = {
  getOverview: (projectId: number) =>
    api.get<ServiceWarrantyOverview>(`${BASE}/${projectId}/service-warranty`).then((r) => r.data),
  activateWarranty: (projectId: number, body: WarrantyActivateBody) =>
    api.post<WarrantyInfo>(`${BASE}/${projectId}/warranty`, body).then((r) => r.data),
  createServiceWork: (projectId: number, body: ServiceWorkBody) =>
    api.post<ServiceWork>(`${BASE}/${projectId}/service-works`, body).then((r) => r.data),
  updateServiceWork: (id: number, body: ServiceWorkBody) =>
    api.put<ServiceWork>(`/service-works/${id}`, body).then((r) => r.data),
  raiseInvoice: (id: number, body: RaiseInvoiceBody) =>
    api.post<ServiceWork>(`/service-works/${id}/invoice`, body).then((r) => r.data),
};
