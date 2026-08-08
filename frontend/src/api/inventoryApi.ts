import api from '../lib/api';
import {
  Product, Warehouse, WarehouseStockSummary, InventoryCategory, InventoryItem,
  InventoryTransaction, ProductAvailability, InventoryDashboard,
  StockTransfer, MaterialRequest, DamageEntry, PurchaseRequest, ProductSupplier,
} from '../types/inventory';

// Thin typed wrapper around /api/inventory, /api/purchases (purchase-requests), and the
// inventory-scoped /api/reports endpoints — mirrors boqApi.ts's conventions.

const BASE = '/inventory';

export const inventoryApi = {
  // Products / Material Master
  getProducts: (params: { search?: string; page?: number; size?: number }) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    query.set('page', String(params.page ?? 0));
    query.set('size', String(params.size ?? 20));
    return api.get(`${BASE}/products?${query.toString()}`).then((r) => r.data as { content: Product[]; totalElements: number; totalPages: number });
  },
  createProduct: (product: Partial<Product>) => api.post<Product>(`${BASE}/products`, product).then((r) => r.data),
  updateProduct: (id: number, product: Partial<Product>) => api.put<Product>(`${BASE}/products/${id}`, product).then((r) => r.data),
  deactivateProduct: (id: number) => api.post<Product>(`${BASE}/products/${id}/deactivate`).then((r) => r.data),
  getAvailability: (id: number) => api.get<ProductAvailability>(`${BASE}/products/${id}/availability`).then((r) => r.data),
  findByBarcode: (code: string) => api.get<Product>(`${BASE}/products/barcode/${encodeURIComponent(code)}`).then((r) => r.data),

  // Dashboard / stock / alerts / transactions (generic stock entry)
  getDashboard: () => api.get<InventoryDashboard>(`${BASE}/dashboard`).then((r) => r.data),
  getAllStock: () => api.get<InventoryItem[]>(`${BASE}/stock`).then((r) => r.data),
  getLowStockAlerts: () => api.get<InventoryItem[]>(`${BASE}/alerts/low-stock`).then((r) => r.data),
  getRecentTransactions: () => api.get<InventoryTransaction[]>(`${BASE}/transactions`).then((r) => r.data),
  processTransaction: (tx: Record<string, unknown>) => api.post<InventoryTransaction>(`${BASE}/transactions`, tx).then((r) => r.data),

  // Warehouses
  getWarehouses: () => api.get<Warehouse[]>(`${BASE}/warehouses`).then((r) => r.data),
  getWarehouse: (id: number) => api.get<Warehouse>(`${BASE}/warehouses/${id}`).then((r) => r.data),
  createWarehouse: (warehouse: Partial<Warehouse>) => api.post<Warehouse>(`${BASE}/warehouses`, warehouse).then((r) => r.data),
  updateWarehouse: (id: number, warehouse: Partial<Warehouse>) => api.put<Warehouse>(`${BASE}/warehouses/${id}`, warehouse).then((r) => r.data),
  deleteWarehouse: (id: number) => api.delete(`${BASE}/warehouses/${id}`),
  getWarehouseStockSummary: (id: number) => api.get<WarehouseStockSummary>(`${BASE}/warehouses/${id}/stock-summary`).then((r) => r.data),

  // Categories
  getCategories: () => api.get<InventoryCategory[]>(`${BASE}/categories`).then((r) => r.data),
  getRootCategories: () => api.get<InventoryCategory[]>(`${BASE}/categories/roots`).then((r) => r.data),
  createCategory: (category: Partial<InventoryCategory>) => api.post<InventoryCategory>(`${BASE}/categories`, category).then((r) => r.data),
  updateCategory: (id: number, category: Partial<InventoryCategory>) => api.put<InventoryCategory>(`${BASE}/categories/${id}`, category).then((r) => r.data),
  deleteCategory: (id: number) => api.delete(`${BASE}/categories/${id}`),

  // Product suppliers
  getProductSuppliers: (productId: number) => api.get<ProductSupplier[]>(`${BASE}/products/${productId}/suppliers`).then((r) => r.data),
  addProductSupplier: (productId: number, supplierId: number, details: Partial<ProductSupplier>) =>
    api.post<ProductSupplier>(`${BASE}/products/${productId}/suppliers?supplierId=${supplierId}`, details).then((r) => r.data),
  updateProductSupplier: (productId: number, id: number, details: Partial<ProductSupplier>) =>
    api.put<ProductSupplier>(`${BASE}/products/${productId}/suppliers/${id}`, details).then((r) => r.data),
  deleteProductSupplier: (productId: number, id: number) => api.delete(`${BASE}/products/${productId}/suppliers/${id}`),

  // Stock transfers
  getTransfers: (status?: string) => api.get<StockTransfer[]>(`${BASE}/transfers${status ? `?status=${status}` : ''}`).then((r) => r.data),
  getTransfer: (id: number) => api.get<StockTransfer>(`${BASE}/transfers/${id}`).then((r) => r.data),
  createTransfer: (payload: { sourceWarehouseId: number; destinationWarehouseId: number; items: { productId: number; quantity: number }[]; notes?: string }) =>
    api.post<StockTransfer>(`${BASE}/transfers`, payload).then((r) => r.data),
  approveTransfer: (id: number) => api.post<StockTransfer>(`${BASE}/transfers/${id}/approve`).then((r) => r.data),
  rejectTransfer: (id: number) => api.post<StockTransfer>(`${BASE}/transfers/${id}/reject`).then((r) => r.data),
  markTransferInTransit: (id: number) => api.post<StockTransfer>(`${BASE}/transfers/${id}/in-transit`).then((r) => r.data),
  receiveTransfer: (id: number) => api.post<StockTransfer>(`${BASE}/transfers/${id}/receive`).then((r) => r.data),

  // Material requests
  getMaterialRequests: (status?: string) => api.get<MaterialRequest[]>(`${BASE}/material-requests${status ? `?status=${status}` : ''}`).then((r) => r.data),
  getMyMaterialRequests: () => api.get<MaterialRequest[]>(`${BASE}/material-requests/mine`).then((r) => r.data),
  getMaterialRequest: (id: number) => api.get<MaterialRequest>(`${BASE}/material-requests/${id}`).then((r) => r.data),
  createMaterialRequest: (payload: { taskId?: number; projectId?: number; warehouseId?: number; items: { productId: number; quantity: number }[]; remarks?: string }) =>
    api.post<MaterialRequest>(`${BASE}/material-requests`, payload).then((r) => r.data),
  approveMaterialRequest: (id: number) => api.post<MaterialRequest>(`${BASE}/material-requests/${id}/approve`).then((r) => r.data),
  rejectMaterialRequest: (id: number, reason?: string) =>
    api.post<MaterialRequest>(`${BASE}/material-requests/${id}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`).then((r) => r.data),
  issueMaterialRequest: (id: number) => api.post<MaterialRequest>(`${BASE}/material-requests/${id}/issue`).then((r) => r.data),

  // Damage entries
  getDamageEntries: () => api.get<DamageEntry[]>(`${BASE}/damage-entries`).then((r) => r.data),
  reportDamage: (payload: { productId: number; warehouseId: number; quantity: number; reason?: string; photoUrl?: string; responsiblePersonId?: number }) =>
    api.post<DamageEntry>(`${BASE}/damage-entries`, payload).then((r) => r.data),
  writeOffDamage: (id: number) => api.post<DamageEntry>(`${BASE}/damage-entries/${id}/write-off`).then((r) => r.data),

  // Purchase requests (system-generated low-stock queue)
  getPurchaseRequests: (status?: string) => api.get<PurchaseRequest[]>(`${BASE}/purchase-requests${status ? `?status=${status}` : ''}`).then((r) => r.data),
  triggerPurchaseRequestScan: () => api.post<{ created: number }>(`${BASE}/purchase-requests/scan`).then((r) => r.data),
  convertPurchaseRequest: (id: number) => api.post(`${BASE}/purchase-requests/${id}/convert`).then((r) => r.data),
  rejectPurchaseRequest: (id: number, reason?: string) =>
    api.post<PurchaseRequest>(`${BASE}/purchase-requests/${id}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`).then((r) => r.data),

  // Inventory reports
  getInventorySummaryReport: () => api.get(`/reports/inventory/summary`).then((r) => r.data),
  getStockValuationReport: () => api.get(`/reports/inventory/valuation`).then((r) => r.data),
  getLowStockReport: () => api.get(`/reports/inventory/low-stock`).then((r) => r.data),
  getMaterialMovementReport: (from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    return api.get(`/reports/inventory/movement?${query.toString()}`).then((r) => r.data);
  },
  getProjectMaterialCost: (projectId: number) => api.get(`/reports/project-material-cost/${projectId}`).then((r) => r.data),
};
