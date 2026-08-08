import api from '../lib/api';
import type {
  Contractor, ContractorDetail, ContractorDashboard, ContractorLedger, ContractorPerformance,
  ContractorWorkPackage, WorkPackageDetail, WorkPackageItem, WorkPackageAssignment, WorkPackageChange,
  ContractorMaterialIssue, ContractorMaterialIssueItem, ContractorDailyProgress, ContractorProgressMedia,
  ContractorQualityInspection, ContractorAttendance, ContractorSafetyRecord, ContractorDocument,
  ContractorBill, ContractorBillItem, BillDetail, PreparedBill, ContractorPayment,
  ContractorOutstanding, GenerateFromBoqResult,
} from '../types/contractor';

// Thin typed wrapper around /api/contractors, /api/work-packages and /api/contractor-bills —
// mirrors purchaseApi.ts's conventions.

const C = '/contractors';
const WP = '/work-packages';
const CB = '/contractor-bills';

export interface Paged<T> { content: T[]; totalElements: number; totalPages: number; number: number }

const qs = (params: Record<string, unknown>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const contractorApi = {
  // ---------------------------------------------------------------- master
  getDashboard: () => api.get<ContractorDashboard>(`${C}/dashboard`).then((r) => r.data),
  getMeta: () => api.get<{ trades: string[]; contractorTypes: string[]; rateTypes: string[]; statuses: string[] }>(
    `${C}/meta`).then((r) => r.data),

  list: (params: { search?: string; trade?: string; status?: string; minRating?: number; page?: number; size?: number } = {}) =>
    api.get<Paged<Contractor>>(`${C}${qs({ ...params, page: params.page ?? 0, size: params.size ?? 20 })}`)
      .then((r) => r.data),

  get: (id: number) => api.get<ContractorDetail>(`${C}/${id}`).then((r) => r.data),
  getBasic: (id: number) => api.get<Contractor>(`${C}/${id}/basic`).then((r) => r.data),
  create: (payload: Partial<Contractor>) => api.post<Contractor>(C, payload).then((r) => r.data),
  update: (id: number, payload: Partial<Contractor>) => api.put<Contractor>(`${C}/${id}`, payload).then((r) => r.data),
  setStatus: (id: number, status: string, reason?: string) =>
    api.patch<Contractor>(`${C}/${id}/status${qs({ status, reason })}`).then((r) => r.data),
  remove: (id: number) => api.delete(`${C}/${id}`).then((r) => r.data),

  getLedger: (id: number, from?: string, to?: string) =>
    api.get<ContractorLedger>(`${C}/${id}/ledger${qs({ from, to })}`).then((r) => r.data),
  getPerformance: (id: number) => api.get<ContractorPerformance>(`${C}/${id}/performance`).then((r) => r.data),
  getProjectPayments: (id: number) =>
    api.get<{ projectId: number; projectName: string; contractValue: number; paid: number; pending: number; status: string }[]>(
      `${C}/${id}/project-payments`).then((r) => r.data),
  getComplianceAlerts: () =>
    api.get<{ windowDays: number; contractors: Contractor[]; documents: ContractorDocument[] }>(
      `${C}/compliance-alerts`).then((r) => r.data),

  // documents
  getDocuments: (id: number) => api.get<ContractorDocument[]>(`${C}/${id}/documents`).then((r) => r.data),
  addDocument: (id: number, doc: Partial<ContractorDocument>) =>
    api.post<ContractorDocument>(`${C}/${id}/documents`, doc).then((r) => r.data),
  verifyDocument: (documentId: number) =>
    api.post<ContractorDocument>(`${C}/documents/${documentId}/verify`).then((r) => r.data),
  deleteDocument: (documentId: number) => api.delete(`${C}/documents/${documentId}`).then((r) => r.data),

  // reports
  reportPerformance: () => api.get<Record<string, unknown>[]>(`${C}/reports/performance`).then((r) => r.data),
  reportDelayedWorks: () => api.get<Record<string, unknown>[]>(`${C}/reports/delayed-works`).then((r) => r.data),
  reportCostAnalysis: (projectId?: number) =>
    api.get<Record<string, unknown>[]>(`${C}/reports/cost-analysis${qs({ projectId })}`).then((r) => r.data),
  reportPaymentSummary: () => api.get<Record<string, unknown>[]>(`${C}/reports/payment-summary`).then((r) => r.data),
  reportOutstandingBills: () => api.get<Record<string, unknown>[]>(`${C}/reports/outstanding-bills`).then((r) => r.data),
  reportMaterialConsumption: (contractorId?: number, projectId?: number) =>
    api.get<Record<string, unknown>[]>(`${C}/reports/material-consumption${qs({ contractorId, projectId })}`)
      .then((r) => r.data),
  reportQuality: (contractorId?: number, projectId?: number) =>
    api.get<Record<string, unknown>[]>(`${C}/reports/quality${qs({ contractorId, projectId })}`).then((r) => r.data),
  reportAttendance: (contractorId?: number, from?: string, to?: string) =>
    api.get<Record<string, unknown>[]>(`${C}/reports/attendance${qs({ contractorId, from, to })}`).then((r) => r.data),
  reportSafety: (contractorId?: number) =>
    api.get<Record<string, unknown>[]>(`${C}/reports/safety${qs({ contractorId })}`).then((r) => r.data),

  // -------------------------------------------------------- work packages
  listWorkPackages: (params: {
    projectId?: number; phaseId?: number; roomId?: number; contractorId?: number;
    trade?: string; status?: string; search?: string; page?: number; size?: number;
  } = {}) =>
    api.get<Paged<ContractorWorkPackage>>(`${WP}${qs({ ...params, page: params.page ?? 0, size: params.size ?? 20 })}`)
      .then((r) => r.data),

  getWorkPackagesByProject: (projectId: number) =>
    api.get<ContractorWorkPackage[]>(`${WP}/by-project/${projectId}`).then((r) => r.data),

  getWorkPackage: (id: number) => api.get<WorkPackageDetail>(`${WP}/${id}`).then((r) => r.data),

  createWorkPackage: (payload: {
    projectId: number; phaseId?: number; roomId?: number; boqId?: number;
    boqItemIds?: number[]; workPackage: Partial<ContractorWorkPackage>;
  }) => api.post<ContractorWorkPackage>(WP, payload).then((r) => r.data),

  updateWorkPackage: (id: number, payload: {
    phaseId?: number; roomId?: number; boqId?: number; workPackage: Partial<ContractorWorkPackage>;
  }) => api.put<ContractorWorkPackage>(`${WP}/${id}`, payload).then((r) => r.data),

  generateFromBoq: (projectId: number) =>
    api.post<GenerateFromBoqResult>(`${WP}/generate-from-boq/${projectId}`).then((r) => r.data),

  // items
  getItems: (id: number) => api.get<WorkPackageItem[]>(`${WP}/${id}/items`).then((r) => r.data),
  addBoqItems: (id: number, boqItemIds: number[]) =>
    api.post<WorkPackageItem[]>(`${WP}/${id}/items/boq`, boqItemIds).then((r) => r.data),
  addItem: (id: number, item: Partial<WorkPackageItem>) =>
    api.post<WorkPackageItem>(`${WP}/${id}/items`, item).then((r) => r.data),
  updateItem: (itemId: number, item: Partial<WorkPackageItem>) =>
    api.put<WorkPackageItem>(`${WP}/items/${itemId}`, item).then((r) => r.data),
  removeItem: (itemId: number) => api.delete(`${WP}/items/${itemId}`).then((r) => r.data),

  // assignment
  getAssignments: (id: number) => api.get<WorkPackageAssignment[]>(`${WP}/${id}/assignments`).then((r) => r.data),
  assign: (id: number, contractorId: number, assignment: Partial<WorkPackageAssignment>) =>
    api.post<WorkPackageAssignment>(`${WP}/${id}/assign`, { contractorId, assignment }).then((r) => r.data),
  acceptAssignment: (assignmentId: number, remarks?: string) =>
    api.post<WorkPackageAssignment>(`${WP}/assignments/${assignmentId}/accept${qs({ remarks })}`).then((r) => r.data),
  rejectAssignment: (assignmentId: number, reason?: string) =>
    api.post<WorkPackageAssignment>(`${WP}/assignments/${assignmentId}/reject${qs({ reason })}`).then((r) => r.data),
  terminateAssignment: (assignmentId: number, reason?: string) =>
    api.post<WorkPackageAssignment>(`${WP}/assignments/${assignmentId}/terminate${qs({ reason })}`).then((r) => r.data),

  // lifecycle
  startWork: (id: number) => api.post<ContractorWorkPackage>(`${WP}/${id}/start`).then((r) => r.data),
  holdWork: (id: number, reason?: string) =>
    api.post<ContractorWorkPackage>(`${WP}/${id}/hold${qs({ reason })}`).then((r) => r.data),
  markWorkCompleted: (id: number) => api.post<ContractorWorkPackage>(`${WP}/${id}/work-completed`).then((r) => r.data),
  completeWorkPackage: (id: number) => api.post<ContractorWorkPackage>(`${WP}/${id}/complete`).then((r) => r.data),
  cancelWorkPackage: (id: number, reason?: string) =>
    api.post<ContractorWorkPackage>(`${WP}/${id}/cancel${qs({ reason })}`).then((r) => r.data),
  recompute: (id: number) => api.post<ContractorWorkPackage>(`${WP}/${id}/recompute`).then((r) => r.data),

  // material issue
  getMaterialIssues: (id: number) => api.get<ContractorMaterialIssue[]>(`${WP}/${id}/material-issues`).then((r) => r.data),
  getMaterialIssue: (issueId: number) =>
    api.get<{ issue: ContractorMaterialIssue; items: ContractorMaterialIssueItem[] }>(
      `${WP}/material-issues/${issueId}`).then((r) => r.data),
  createMaterialIssue: (id: number, payload: {
    contractorId: number; warehouseId?: number;
    issue: Partial<ContractorMaterialIssue>;
    items: { product: { id: number }; issuedQuantity: number; unitRate?: number; unit?: string; remarks?: string }[];
  }) => api.post<ContractorMaterialIssue>(`${WP}/${id}/material-issues`, payload).then((r) => r.data),
  confirmMaterialIssue: (issueId: number) =>
    api.post<ContractorMaterialIssue>(`${WP}/material-issues/${issueId}/confirm`).then((r) => r.data),
  reconcileMaterialIssue: (issueId: number, lines: Partial<ContractorMaterialIssueItem>[]) =>
    api.post<ContractorMaterialIssue>(`${WP}/material-issues/${issueId}/reconcile`, lines).then((r) => r.data),
  cancelMaterialIssue: (issueId: number, reason?: string) =>
    api.post<ContractorMaterialIssue>(`${WP}/material-issues/${issueId}/cancel${qs({ reason })}`).then((r) => r.data),

  // progress
  getProgress: (id: number) => api.get<ContractorDailyProgress[]>(`${WP}/${id}/progress`).then((r) => r.data),
  getTodaysProgress: () => api.get<ContractorDailyProgress[]>(`${WP}/progress/today`).then((r) => r.data),
  getProgressMedia: (progressId: number) =>
    api.get<ContractorProgressMedia[]>(`${WP}/progress/${progressId}/media`).then((r) => r.data),
  recordProgress: (id: number, payload: {
    contractorId: number; progress: Partial<ContractorDailyProgress>; media?: ContractorProgressMedia[];
  }) => api.post<ContractorDailyProgress>(`${WP}/${id}/progress`, payload).then((r) => r.data),
  verifyProgress: (progressId: number, approve: boolean, remarks?: string) =>
    api.post<ContractorDailyProgress>(`${WP}/progress/${progressId}/verify${qs({ approve, remarks })}`)
      .then((r) => r.data),

  // quality
  getInspections: (id: number) => api.get<ContractorQualityInspection[]>(`${WP}/${id}/inspections`).then((r) => r.data),
  getOpenQualityIssues: () =>
    api.get<ContractorQualityInspection[]>(`${WP}/inspections/open-issues`).then((r) => r.data),
  recordInspection: (id: number, payload: {
    inspection: Partial<ContractorQualityInspection>; media?: ContractorProgressMedia[];
  }) => api.post<ContractorQualityInspection>(`${WP}/${id}/inspections`, payload).then((r) => r.data),
  approveInspection: (inspectionId: number, comments?: string) =>
    api.post<ContractorQualityInspection>(`${WP}/inspections/${inspectionId}/approve${qs({ comments })}`)
      .then((r) => r.data),

  // attendance & safety
  getPackageAttendance: (id: number) => api.get<ContractorAttendance[]>(`${WP}/${id}/attendance`).then((r) => r.data),
  getContractorAttendance: (contractorId: number, from?: string, to?: string) =>
    api.get<ContractorAttendance[]>(`${WP}/attendance/by-contractor/${contractorId}${qs({ from, to })}`)
      .then((r) => r.data),
  recordAttendance: (id: number, contractorId: number, attendance: Partial<ContractorAttendance>) =>
    api.post<ContractorAttendance>(`${WP}/${id}/attendance${qs({ contractorId })}`, attendance).then((r) => r.data),
  getPackageSafety: (id: number) => api.get<ContractorSafetyRecord[]>(`${WP}/${id}/safety`).then((r) => r.data),
  recordSafety: (id: number, contractorId: number, record: Partial<ContractorSafetyRecord>) =>
    api.post<ContractorSafetyRecord>(`${WP}/${id}/safety${qs({ contractorId })}`, record).then((r) => r.data),
  closeSafety: (recordId: number, actionTaken?: string) =>
    api.post<ContractorSafetyRecord>(`${WP}/safety/${recordId}/close${qs({ actionTaken })}`).then((r) => r.data),

  // changes
  getChanges: (id: number) => api.get<WorkPackageChange[]>(`${WP}/${id}/changes`).then((r) => r.data),
  createChange: (id: number, change: Partial<WorkPackageChange>) =>
    api.post<WorkPackageChange>(`${WP}/${id}/changes`, change).then((r) => r.data),
  approveChange: (changeId: number) =>
    api.post<WorkPackageChange>(`${WP}/changes/${changeId}/approve`).then((r) => r.data),
  rejectChange: (changeId: number, reason?: string) =>
    api.post<WorkPackageChange>(`${WP}/changes/${changeId}/reject${qs({ reason })}`).then((r) => r.data),

  // ---------------------------------------------------------------- bills
  listBills: (params: {
    contractorId?: number; projectId?: number; workPackageId?: number; status?: string;
    billType?: string; from?: string; to?: string; page?: number; size?: number;
  } = {}) =>
    api.get<Paged<ContractorBill>>(`${CB}${qs({ ...params, page: params.page ?? 0, size: params.size ?? 20 })}`)
      .then((r) => r.data),

  getBillsPendingApproval: () => api.get<ContractorBill[]>(`${CB}/pending-approval`).then((r) => r.data),
  getPayableBills: () => api.get<ContractorBill[]>(`${CB}/payable`).then((r) => r.data),
  getBill: (id: number) => api.get<BillDetail>(`${CB}/${id}`).then((r) => r.data),

  prepareBill: (workPackageId: number, contractorId: number, billType = 'RUNNING') =>
    api.get<PreparedBill>(`${CB}/prepare${qs({ workPackageId, contractorId, billType })}`).then((r) => r.data),

  createBill: (payload: {
    contractorId: number; workPackageId?: number;
    bill: Partial<ContractorBill>; items?: Partial<ContractorBillItem>[];
  }) => api.post<ContractorBill>(CB, payload).then((r) => r.data),

  updateBill: (id: number, payload: { bill: Partial<ContractorBill>; items?: Partial<ContractorBillItem>[] }) =>
    api.put<ContractorBill>(`${CB}/${id}`, payload).then((r) => r.data),

  submitBill: (id: number) => api.post<ContractorBill>(`${CB}/${id}/submit`).then((r) => r.data),
  approveBill: (id: number, comments?: string, approvedAmount?: number) =>
    api.post<ContractorBill>(`${CB}/${id}/approve${qs({ comments, approvedAmount })}`).then((r) => r.data),
  rejectBill: (id: number, reason?: string) =>
    api.post<ContractorBill>(`${CB}/${id}/reject${qs({ reason })}`).then((r) => r.data),
  cancelBill: (id: number, reason?: string) =>
    api.post<ContractorBill>(`${CB}/${id}/cancel${qs({ reason })}`).then((r) => r.data),

  // payments
  getPaymentsForContractor: (contractorId: number) =>
    api.get<ContractorPayment[]>(`${CB}/payments/by-contractor/${contractorId}`).then((r) => r.data),
  getPayments: (status = 'PAID') =>
    api.get<ContractorPayment[]>(`${CB}/payments${qs({ status })}`).then((r) => r.data),
  recordPayment: (payload: { contractorId: number; billId?: number; payment: Partial<ContractorPayment> }) =>
    api.post<ContractorPayment>(`${CB}/payments`, payload).then((r) => r.data),
  releaseRetention: (contractorId: number, workPackageId: number, amount?: number, remarks?: string) =>
    api.post<ContractorPayment>(`${CB}/payments/release-retention${qs({ contractorId, workPackageId, amount, remarks })}`)
      .then((r) => r.data),
  getOutstanding: (contractorId: number) =>
    api.get<ContractorOutstanding>(`${CB}/outstanding/${contractorId}`).then((r) => r.data),
};

export default contractorApi;
