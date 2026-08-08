import api from '../lib/api';
import {
  Supplier, SupplierProfile, PurchaseRequest, PurchaseOrder, PurchaseOrderItem,
  GoodsReceiptNote, GoodsReceiptNoteItem, GrnPhoto, PurchaseBill, PurchasePayment,
  PurchaseReturn, PurchaseReturnItem, PurchaseDashboard, PriceComparisonRow,
} from '../types/purchase';

// Thin typed wrapper around /api/purchases and the purchase-scoped /api/reports endpoints —
// mirrors inventoryApi.ts's conventions.

const BASE = '/purchases';

export interface PoPage { content: PurchaseOrder[]; totalElements: number; totalPages: number }

export const purchaseApi = {
  // Dashboard
  getDashboard: () => api.get<PurchaseDashboard>(`${BASE}/dashboard`).then((r) => r.data),

  // Suppliers
  getSuppliers: (search?: string) =>
    api.get<Supplier[]>(`${BASE}/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((r) => r.data),
  getSupplier: (id: number) => api.get<Supplier>(`${BASE}/suppliers/${id}`).then((r) => r.data),
  getSupplierProfile: (id: number) => api.get<SupplierProfile>(`${BASE}/suppliers/${id}/profile`).then((r) => r.data),
  createSupplier: (supplier: Partial<Supplier>) => api.post<Supplier>(`${BASE}/suppliers`, supplier).then((r) => r.data),
  updateSupplier: (id: number, supplier: Partial<Supplier>) => api.put<Supplier>(`${BASE}/suppliers/${id}`, supplier).then((r) => r.data),

  // Price comparison
  comparePrices: (productId: number) =>
    api.get<PriceComparisonRow[]>(`${BASE}/price-comparison/${productId}`).then((r) => r.data),

  // Purchase requests (full module view — same resource as /inventory/purchase-requests)
  getPurchaseRequests: (status?: string) =>
    api.get<PurchaseRequest[]>(`${BASE}/requests${status ? `?status=${status}` : ''}`).then((r) => r.data),
  getMyPurchaseRequests: () => api.get<PurchaseRequest[]>(`${BASE}/requests/mine`).then((r) => r.data),
  getPurchaseRequest: (id: number) => api.get<PurchaseRequest>(`${BASE}/requests/${id}`).then((r) => r.data),
  createPurchaseRequest: (payload: {
    projectId?: number; boqId?: number; warehouseId?: number;
    priority?: string; requiredDate?: string; reason?: string; source?: string;
    approvalLevels?: number;
    items: { productId: number; quantity: number; estimatedUnitPrice?: number; notes?: string }[];
  }) => api.post<PurchaseRequest>(`${BASE}/requests`, payload).then((r) => r.data),
  approvePurchaseRequest: (id: number, comments?: string) =>
    api.post<PurchaseRequest>(`${BASE}/requests/${id}/approve${comments ? `?comments=${encodeURIComponent(comments)}` : ''}`).then((r) => r.data),
  rejectPurchaseRequest: (id: number, reason?: string) =>
    api.post<PurchaseRequest>(`${BASE}/requests/${id}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`).then((r) => r.data),
  convertPurchaseRequest: (id: number) =>
    api.post<PurchaseOrder[]>(`${BASE}/requests/${id}/convert`).then((r) => r.data),
  triggerLowStockScan: () => api.post<{ created: number }>(`${BASE}/requests/scan`).then((r) => r.data),

  // Purchase orders
  getPurchaseOrders: (params: {
    page?: number; size?: number; status?: string; supplierId?: number; projectId?: number;
    warehouseId?: number; from?: string; to?: string; search?: string;
  } = {}) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 0));
    query.set('size', String(params.size ?? 20));
    if (params.status) query.set('status', params.status);
    if (params.supplierId) query.set('supplierId', String(params.supplierId));
    if (params.projectId) query.set('projectId', String(params.projectId));
    if (params.warehouseId) query.set('warehouseId', String(params.warehouseId));
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.search) query.set('search', params.search);
    return api.get(`${BASE}/orders?${query.toString()}`).then((r) => r.data as PoPage);
  },
  getPurchaseOrder: (id: number) => api.get<PurchaseOrder>(`${BASE}/orders/${id}`).then((r) => r.data),
  getPurchaseOrderItems: (id: number) => api.get<PurchaseOrderItem[]>(`${BASE}/orders/${id}/items`).then((r) => r.data),
  createPurchaseOrder: (po: Record<string, unknown>, items: Record<string, unknown>[]) =>
    api.post<PurchaseOrder>(`${BASE}/orders`, { po, items }).then((r) => r.data),
  updatePurchaseOrder: (id: number, po: Record<string, unknown>, items?: Record<string, unknown>[]) =>
    api.put<PurchaseOrder>(`${BASE}/orders/${id}`, { po, items }).then((r) => r.data),
  updatePurchaseOrderStatus: (id: number, status: string) =>
    api.post<PurchaseOrder>(`${BASE}/orders/${id}/status?status=${status}`).then((r) => r.data),

  // GRN
  getAllGrns: () => api.get<GoodsReceiptNote[]>(`${BASE}/grns`).then((r) => r.data),
  getGrnsForPo: (poId: number) => api.get<GoodsReceiptNote[]>(`${BASE}/orders/${poId}/grns`).then((r) => r.data),
  getGrnItems: (grnId: number) => api.get<GoodsReceiptNoteItem[]>(`${BASE}/grns/${grnId}/items`).then((r) => r.data),
  getGrnPhotos: (grnId: number) => api.get<GrnPhoto[]>(`${BASE}/grns/${grnId}/photos`).then((r) => r.data),
  createGrn: (grn: Record<string, unknown>, items: Record<string, unknown>[], photoUrls?: string[]) =>
    api.post<GoodsReceiptNote>(`${BASE}/grns`, { grn, items, photoUrls }).then((r) => r.data),
  recordQualityCheck: (grnId: number, qcStatus: string, reason?: string, remarks?: string) =>
    api.post<GoodsReceiptNote>(`${BASE}/grns/${grnId}/quality-check`, { qcStatus, reason, remarks }).then((r) => r.data),
  approveGrn: (grnId: number) => api.post<GoodsReceiptNote>(`${BASE}/grns/${grnId}/approve`).then((r) => r.data),

  // Bills & payments
  getAllBills: () => api.get<PurchaseBill[]>(`${BASE}/bills`).then((r) => r.data),
  getBillsForPo: (poId: number) => api.get<PurchaseBill[]>(`${BASE}/orders/${poId}/bills`).then((r) => r.data),
  createBill: (bill: Record<string, unknown>) => api.post<PurchaseBill>(`${BASE}/bills`, bill).then((r) => r.data),
  getAllPayments: () => api.get<PurchasePayment[]>(`${BASE}/payments`).then((r) => r.data),
  getPaymentsForBill: (billId: number) => api.get<PurchasePayment[]>(`${BASE}/bills/${billId}/payments`).then((r) => r.data),
  addPayment: (payment: Record<string, unknown>) => api.post<PurchasePayment>(`${BASE}/payments`, payment).then((r) => r.data),

  // Returns
  getAllReturns: () => api.get<PurchaseReturn[]>(`${BASE}/returns`).then((r) => r.data),
  getReturnItems: (id: number) => api.get<PurchaseReturnItem[]>(`${BASE}/returns/${id}/items`).then((r) => r.data),
  createReturn: (purchaseReturn: Record<string, unknown>, items: Record<string, unknown>[]) =>
    api.post<PurchaseReturn>(`${BASE}/returns`, { purchaseReturn, items }).then((r) => r.data),
  confirmReturn: (id: number) => api.post<PurchaseReturn>(`${BASE}/returns/${id}/confirm`).then((r) => r.data),

  // Reports
  getPurchaseSummary: (from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    return api.get(`/reports/purchases/summary?${query.toString()}`).then((r) => r.data);
  },
  getSupplierPerformance: () => api.get(`/reports/purchases/supplier-performance`).then((r) => r.data),
  getPendingDeliveries: () => api.get(`/reports/purchases/pending-deliveries`).then((r) => r.data),
  getOutstandingPayments: () => api.get(`/reports/purchases/outstanding-payments`).then((r) => r.data),
  getPurchaseTrends: () => api.get(`/reports/purchases/trends`).then((r) => r.data),
  getMaterialCostAnalysis: () => api.get(`/reports/purchases/material-cost`).then((r) => r.data),
  getProjectPurchaseReport: (projectId: number) => api.get(`/reports/purchases/project/${projectId}`).then((r) => r.data),
};
