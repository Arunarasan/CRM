import api from '../lib/api';
import {
  Invoice, InvoiceItem, CustomerPayment, CreditDebitNote, Refund, PaymentSchedule,
  ProjectExpense, CustomerLedger, CustomerOutstanding, ProjectProfitability,
  FinanceDashboard, PageResp, BillingProgress,
  ReturnableInvoice, SalesReturn, SalesReturnItem,
  Cashbook, CompanyTransaction, RecurringExpense,
} from '../types/finance';

// Thin typed wrapper around /api/finance — mirrors purchaseApi.ts's conventions.

const BASE = '/finance';

const qs = (params: Record<string, unknown>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.set(k, String(v));
  });
  const s = query.toString();
  return s ? `?${s}` : '';
};

export const financeApi = {
  // Dashboard
  getDashboard: () => api.get<FinanceDashboard>(`${BASE}/dashboard`).then((r) => r.data),

  // Invoices
  getInvoices: (params: {
    page?: number; size?: number; status?: string; invoiceType?: string; customerId?: number;
    projectId?: number; from?: string; to?: string; search?: string;
  } = {}) => api.get<PageResp<Invoice>>(`${BASE}/invoices${qs({ page: params.page ?? 0, size: params.size ?? 20, ...params })}`).then((r) => r.data),
  getInvoice: (id: number) => api.get<Invoice>(`${BASE}/invoices/${id}`).then((r) => r.data),
  getInvoiceItems: (id: number) => api.get<InvoiceItem[]>(`${BASE}/invoices/${id}/items`).then((r) => r.data),
  getInvoicePayments: (id: number) => api.get<CustomerPayment[]>(`${BASE}/invoices/${id}/payments`).then((r) => r.data),
  createInvoice: (invoice: Record<string, unknown>, items: Record<string, unknown>[]) =>
    api.post<Invoice>(`${BASE}/invoices`, { invoice, items }).then((r) => r.data),
  updateDraftInvoice: (id: number, invoice: Record<string, unknown>, items?: Record<string, unknown>[]) =>
    api.put<Invoice>(`${BASE}/invoices/${id}`, { invoice, items }).then((r) => r.data),
  issueInvoice: (id: number) => api.post<Invoice>(`${BASE}/invoices/${id}/issue`).then((r) => r.data),
  sendInvoice: (id: number) => api.post<Invoice>(`${BASE}/invoices/${id}/send`).then((r) => r.data),
  cancelInvoice: (id: number, reason?: string) =>
    api.post<Invoice>(`${BASE}/invoices/${id}/cancel${qs({ reason })}`).then((r) => r.data),
  markInvoicePaid: (id: number, splits: { method: string; amount: number; referenceNumber?: string }[]) =>
    api.post<Invoice>(`${BASE}/invoices/${id}/mark-paid`, splits).then((r) => r.data),
  markInvoiceUnpaid: (id: number) =>
    api.post<Invoice>(`${BASE}/invoices/${id}/mark-unpaid`).then((r) => r.data),
  // Walk-in / counter sale
  createCounterSale: (payload: Record<string, unknown>) =>
    api.post<Invoice>(`${BASE}/counter-sale`, payload).then((r) => r.data),
  getAssignableEmployees: () =>
    api.get<{ id: number; name: string }[]>(`${BASE}/assignable-employees`).then((r) => r.data),

  generateFromQuotation: (quotationId: number, advancePercent?: number, draft = true) =>
    api.post<Invoice>(`${BASE}/invoices/generate-from-quotation/${quotationId}${qs({ advancePercent, draft })}`).then((r) => r.data),
  generateStageInvoice: (scheduleId: number) =>
    api.post<Invoice>(`${BASE}/schedules/${scheduleId}/generate-invoice`).then((r) => r.data),

  // Payments
  getPayments: (params: {
    page?: number; size?: number; status?: string; customerId?: number; projectId?: number;
    method?: string; from?: string; to?: string; search?: string;
  } = {}) => api.get<PageResp<CustomerPayment>>(`${BASE}/payments${qs({ page: params.page ?? 0, size: params.size ?? 20, ...params })}`).then((r) => r.data),
  getPendingApprovalPayments: () =>
    api.get<CustomerPayment[]>(`${BASE}/payments/pending-approval`).then((r) => r.data),
  recordPayment: (payment: Record<string, unknown>) =>
    api.post<CustomerPayment>(`${BASE}/payments`, payment).then((r) => r.data),
  approvePayment: (id: number) => api.post<CustomerPayment>(`${BASE}/payments/${id}/approve`).then((r) => r.data),
  rejectPayment: (id: number, reason?: string) =>
    api.post<CustomerPayment>(`${BASE}/payments/${id}/reject${qs({ reason })}`).then((r) => r.data),

  // Sales / product returns
  getReturnableItems: (invoiceId: number) =>
    api.get<ReturnableInvoice>(`${BASE}/invoices/${invoiceId}/returnable`).then((r) => r.data),
  getSalesReturns: (page = 0, size = 20) =>
    api.get<PageResp<SalesReturn>>(`${BASE}/sales-returns${qs({ page, size })}`).then((r) => r.data),
  getSalesReturn: (id: number) => api.get<SalesReturn>(`${BASE}/sales-returns/${id}`).then((r) => r.data),
  getSalesReturnItems: (id: number) => api.get<SalesReturnItem[]>(`${BASE}/sales-returns/${id}/items`).then((r) => r.data),
  createSalesReturn: (payload: Record<string, unknown>) =>
    api.post<SalesReturn>(`${BASE}/sales-returns`, payload).then((r) => r.data),

  // Credit / debit notes
  getNotes: (page = 0, size = 20) =>
    api.get<PageResp<CreditDebitNote>>(`${BASE}/notes${qs({ page, size })}`).then((r) => r.data),
  addNote: (note: Record<string, unknown>) => api.post<CreditDebitNote>(`${BASE}/notes`, note).then((r) => r.data),
  cancelNote: (id: number) => api.post<CreditDebitNote>(`${BASE}/notes/${id}/cancel`).then((r) => r.data),

  // Refunds
  getRefunds: (page = 0, size = 20) =>
    api.get<PageResp<Refund>>(`${BASE}/refunds${qs({ page, size })}`).then((r) => r.data),
  requestRefund: (refund: Record<string, unknown>) => api.post<Refund>(`${BASE}/refunds`, refund).then((r) => r.data),
  approveRefund: (id: number) => api.post<Refund>(`${BASE}/refunds/${id}/approve`).then((r) => r.data),
  rejectRefund: (id: number) => api.post<Refund>(`${BASE}/refunds/${id}/reject`).then((r) => r.data),
  markRefundPaid: (id: number, paymentMethod?: string, referenceNumber?: string) =>
    api.post<Refund>(`${BASE}/refunds/${id}/mark-paid`, { paymentMethod, referenceNumber }).then((r) => r.data),

  // Payment schedules
  getSchedules: (projectId: number) =>
    api.get<PaymentSchedule[]>(`${BASE}/projects/${projectId}/schedules`).then((r) => r.data),
  saveSchedule: (schedule: Record<string, unknown>) =>
    api.post<PaymentSchedule>(`${BASE}/schedules`, schedule).then((r) => r.data),
  deleteSchedule: (id: number) => api.delete(`${BASE}/schedules/${id}`).then(() => undefined),
  generateDefaultSchedule: (projectId: number) =>
    api.post<PaymentSchedule[]>(`${BASE}/projects/${projectId}/schedules/generate-default`).then((r) => r.data),

  // Combined completion + billing tracker
  getBillingProgress: (projectId: number) =>
    api.get<BillingProgress>(`${BASE}/projects/${projectId}/billing-progress`).then((r) => r.data),
  setAutoBilling: (projectId: number, enabled: boolean) =>
    api.put<{ autoBillingEnabled: boolean }>(`${BASE}/projects/${projectId}/auto-billing?enabled=${enabled}`).then((r) => r.data),

  // Ledger & outstanding
  getCustomerLedger: (customerId: number, from?: string, to?: string) =>
    api.get<CustomerLedger>(`${BASE}/customers/${customerId}/ledger${qs({ from, to })}`).then((r) => r.data),
  getCustomerOutstanding: (customerId: number) =>
    api.get<CustomerOutstanding>(`${BASE}/customers/${customerId}/outstanding`).then((r) => r.data),
  getAllOutstanding: () => api.get<CustomerOutstanding[]>(`${BASE}/outstanding`).then((r) => r.data),

  // Project expenses & profitability
  getExpenses: (projectId?: number, page = 0, size = 20) =>
    api.get<PageResp<ProjectExpense>>(`${BASE}/expenses${qs({ projectId, page, size })}`).then((r) => r.data),
  addExpense: (expense: Record<string, unknown>) =>
    api.post<ProjectExpense>(`${BASE}/expenses`, expense).then((r) => r.data),
  deleteExpense: (id: number) => api.delete(`${BASE}/expenses/${id}`).then(() => undefined),
  syncProjectExpenses: (projectId: number) =>
    api.post<{ projectId: number; documentsSynced: number; totalExpenses: number }>(
      `${BASE}/projects/${projectId}/sync-expenses`).then((r) => r.data),
  getProjectProfitability: (projectId: number) =>
    api.get<ProjectProfitability>(`${BASE}/projects/${projectId}/profitability`).then((r) => r.data),
  getAllProfitability: () => api.get<ProjectProfitability[]>(`${BASE}/profitability`).then((r) => r.data),

  // Cash Book — consolidated money in / money out across every source
  getCashbook: (params: { from?: string; to?: string; direction?: string; source?: string; search?: string } = {}) =>
    api.get<Cashbook>(`${BASE}/cashbook${qs(params)}`).then((r) => r.data),

  // Company transactions — other income & company overhead ("other charges")
  getCompanyTransactions: (params: {
    page?: number; size?: number; direction?: string; category?: string; from?: string; to?: string; search?: string;
  } = {}) => api.get<PageResp<CompanyTransaction>>(
    `${BASE}/company-transactions${qs({ page: params.page ?? 0, size: params.size ?? 20, ...params })}`).then((r) => r.data),
  getCompanyTransactionCategories: () =>
    api.get<{ income: string[]; expense: string[] }>(`${BASE}/company-transactions/categories`).then((r) => r.data),
  addCompanyTransaction: (txn: Record<string, unknown>) =>
    api.post<CompanyTransaction>(`${BASE}/company-transactions`, txn).then((r) => r.data),
  deleteCompanyTransaction: (id: number) =>
    api.delete(`${BASE}/company-transactions/${id}`).then(() => undefined),

  // Recurring expense heads (rent, electricity, internet…)
  getRecurringExpenses: (activeOnly = false) =>
    api.get<RecurringExpense[]>(`${BASE}/recurring-expenses${qs({ activeOnly })}`).then((r) => r.data),
  getRecurringHistory: (id: number) =>
    api.get<CompanyTransaction[]>(`${BASE}/recurring-expenses/${id}/history`).then((r) => r.data),
  saveRecurringExpense: (head: Record<string, unknown>) =>
    api.post<RecurringExpense>(`${BASE}/recurring-expenses`, head).then((r) => r.data),
  updateRecurringExpense: (id: number, head: Record<string, unknown>) =>
    api.put<RecurringExpense>(`${BASE}/recurring-expenses/${id}`, head).then((r) => r.data),
  deleteRecurringExpense: (id: number) =>
    api.delete(`${BASE}/recurring-expenses/${id}`).then(() => undefined),

  // Reports
  getRevenueReport: (from: string, to: string) =>
    api.get(`${BASE}/reports/revenue${qs({ from, to })}`).then((r) => r.data),
  getExpenseReport: (from: string, to: string) =>
    api.get(`${BASE}/reports/expenses${qs({ from, to })}`).then((r) => r.data),
  getProfitLoss: (from: string, to: string) =>
    api.get(`${BASE}/reports/profit-loss${qs({ from, to })}`).then((r) => r.data),
  getGstReport: (from: string, to: string) =>
    api.get(`${BASE}/reports/gst${qs({ from, to })}`).then((r) => r.data),
  getCashFlow: (from: string, to: string) =>
    api.get(`${BASE}/reports/cash-flow${qs({ from, to })}`).then((r) => r.data),
  getPurchaseVsSales: (from: string, to: string) =>
    api.get(`${BASE}/reports/purchase-vs-sales${qs({ from, to })}`).then((r) => r.data),
};

export default financeApi;
