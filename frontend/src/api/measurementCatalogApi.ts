import api from '../lib/api';

// Admin-managed catalog of standard measurement items. Employees pick from this when capturing a
// site measurement; admins manage the entries.

export interface CatalogItem {
  id?: number;
  name: string;
  itemType?: string;
  defaultUnit?: string;
  defaultMaterial?: string;
  active?: boolean;
  orderIndex?: number;
}

const BASE = '/measurement-item-catalog';

export const measurementCatalogApi = {
  // Active items — the employee picker.
  list: () => api.get<CatalogItem[]>(BASE).then((r) => r.data),
  // All items incl. inactive — admin management.
  listAll: () => api.get<CatalogItem[]>(`${BASE}/all`).then((r) => r.data),
  create: (item: CatalogItem) => api.post<CatalogItem>(BASE, item).then((r) => r.data),
  update: (id: number, item: CatalogItem) => api.put<CatalogItem>(`${BASE}/${id}`, item).then((r) => r.data),
  remove: (id: number) => api.delete(`${BASE}/${id}`),
};
