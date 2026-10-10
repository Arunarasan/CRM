import api from '../lib/api';
import {
  SalaryRecord, EmployeeAdvance, EmployeeLoan, FinanceDashboard,
  EmployeeDeduction, WageSettings, PayrollLine, PayrollSummary, PayrollRequest, PayrollPreviewRow, PendingMoneyRequest,
} from '../types/payroll';

export interface PayslipLineItem {
  id: number;
  category: 'EARNING' | 'DEDUCTION';
  label: string;
  amount: number;
  source: string;
}
export interface PayslipEditView {
  record: SalaryRecord | null;
  lineItems: PayslipLineItem[];
  earningPresets: string[];
  deductionPresets: string[];
  /** What the employee still owes after this payslip's repayment. */
  owedBalance?: number;
  pendingRequests?: PendingMoneyRequest[];
}

// Employee payroll — /api/hr endpoints. These return raw bodies (HrController is not wrapped in
// ApiResponse), so we read res.data directly.

export const payrollApi = {
  advancesForEmployee: (employeeId: number) =>
    api.get<EmployeeAdvance[]>(`/hr/employees/${employeeId}/advances`).then((r) => r.data),
  createAdvance: (employeeId: number, body: EmployeeAdvance) =>
    api.post<EmployeeAdvance>(`/hr/employees/${employeeId}/advances`, body).then((r) => r.data),
  approveAdvance: (id: number) =>
    api.post<EmployeeAdvance>(`/hr/advances/${id}/approve`).then((r) => r.data),

  loansForEmployee: (employeeId: number) =>
    api.get<EmployeeLoan[]>(`/hr/employees/${employeeId}/loans`).then((r) => r.data),
  createLoan: (employeeId: number, body: EmployeeLoan) =>
    api.post<EmployeeLoan>(`/hr/employees/${employeeId}/loans`, body).then((r) => r.data),
  closeLoan: (id: number) =>
    api.post<EmployeeLoan>(`/hr/loans/${id}/close`).then((r) => r.data),

  // Hours-based payslips: preview the month's hours priced HOURLY vs MONTHLY, then generate on the
  // chosen basis (omitted ⇒ the employee's usual basis).
  payrollPreview: (month: number, year: number) =>
    api.get<PayrollPreviewRow[]>(`/hr/payroll/preview?month=${month}&year=${year}`).then((r) => r.data),
  generatePayslip: (employeeId: number, month: number, year: number, basis?: 'HOURLY' | 'MONTHLY') =>
    api.post<SalaryRecord>(`/hr/payroll/generate?employeeId=${employeeId}&month=${month}&year=${year}${basis ? `&basis=${basis}` : ''}`).then((r) => r.data),
  generatePayslips: (month: number, year: number, choices: Record<number, 'HOURLY' | 'MONTHLY'>) =>
    api.post<{ generated: number; skipped: number; errors: string[] }>(`/hr/payroll/generate-bulk?month=${month}&year=${year}`, { choices }).then((r) => r.data),
  approvePayroll: (salaryRecordId: number) =>
    api.post<SalaryRecord>(`/hr/payroll/${salaryRecordId}/approve`).then((r) => r.data),

  register: (month: number, year: number) =>
    api.get<SalaryRecord[]>(`/hr/payroll/register?month=${month}&year=${year}`).then((r) => r.data),

  // Unified pay run — every employee AND contractor for the period, one row per person.
  unifiedRegister: (month: number, year: number) =>
    api.get<PayrollLine[]>(`/hr/payroll/unified-register?month=${month}&year=${year}`).then((r) => r.data),
  payrollSummary: (month: number, year: number) =>
    api.get<PayrollSummary>(`/hr/payroll/summary?month=${month}&year=${year}`).then((r) => r.data),
  payslip: (salaryRecordId: number) =>
    api.get<{ record: SalaryRecord; recoveries: any[] }>(`/hr/payslip/${salaryRecordId}`).then((r) => r.data),

  // Editable payslip line items (extra incentives / allowances / deductions)
  editablePayslip: (employeeId: number, month: number, year: number) =>
    api.get<PayslipEditView>(`/hr/payslips?employeeId=${employeeId}&month=${month}&year=${year}`).then((r) => r.data),
  addPayslipLineItem: (recordId: number, body: { category: string; label: string; amount: number }) =>
    api.post<PayslipEditView>(`/hr/payslips/${recordId}/line-items`, body).then((r) => r.data),
  updatePayslipLineItem: (itemId: number, body: { label?: string; amount?: number }) =>
    api.put<PayslipEditView>(`/hr/payslips/line-items/${itemId}`, body).then((r) => r.data),
  deletePayslipLineItem: (itemId: number) =>
    api.delete<PayslipEditView>(`/hr/payslips/line-items/${itemId}`).then((r) => r.data),
  // Edit the payslip's own amounts / hours / days / note (keys left out stay unchanged).
  updatePayslipComponents: (recordId: number, body: Record<string, number | string | null>) =>
    api.put<PayslipEditView>(`/hr/payslips/${recordId}/components`, body).then((r) => r.data),
  // Delete an unpaid payslip (undoes bonuses / deductions / recoveries / leads it used) …
  deletePayslip: (salaryRecordId: number) =>
    api.delete(`/hr/payroll/${salaryRecordId}`).then((r) => r.data),
  // … or delete and generate it again from current data (basis omitted keeps the payslip's own).
  regeneratePayslip: (salaryRecordId: number, basis?: 'HOURLY' | 'MONTHLY') =>
    api.post<SalaryRecord>(`/hr/payroll/${salaryRecordId}/regenerate${basis ? `?basis=${basis}` : ''}`).then((r) => r.data),
  markPaid: (salaryRecordId: number) =>
    api.post<SalaryRecord>(`/hr/payroll/${salaryRecordId}/pay`).then((r) => r.data),

  // Employee bonuses (admin-managed; project-completion / performance / other)
  allBonuses: (status?: string) =>
    api.get<any[]>(`/hr/bonuses${status ? `?status=${status}` : ''}`).then((r) => r.data),
  employeeBonuses: (employeeId: number) =>
    api.get<any>(`/hr/employees/${employeeId}/bonuses`).then((r) => r.data),
  awardBonus: (employeeId: number, body: { bonusType: string; amount: number; reason?: string; awardDate?: string; project?: { id: number } }) =>
    api.post<any>(`/hr/employees/${employeeId}/bonuses`, body).then((r) => r.data),
  recommendBonus: (employeeId: number, body: { bonusType: string; amount: number; reason?: string; project?: { id: number } }) =>
    api.post<any>(`/hr/employees/${employeeId}/bonuses/recommend`, body).then((r) => r.data),
  approveBonus: (id: number) => api.post<any>(`/hr/bonuses/${id}/approve`).then((r) => r.data),
  payBonus: (id: number) => api.post<any>(`/hr/bonuses/${id}/pay`).then((r) => r.data),

  // Manual deductions
  allDeductions: (status?: string) =>
    api.get<EmployeeDeduction[]>(`/hr/deductions${status ? `?status=${status}` : ''}`).then((r) => r.data),
  createDeduction: (employeeId: number, body: EmployeeDeduction) =>
    api.post<EmployeeDeduction>(`/hr/employees/${employeeId}/deductions`, body).then((r) => r.data),
  approveDeduction: (id: number) =>
    api.post<EmployeeDeduction>(`/hr/deductions/${id}/approve`).then((r) => r.data),

  // Employee-raised payroll requests (advance / loan repayment / other) — admin approval queue
  payrollRequests: (status?: string) =>
    api.get<PayrollRequest[]>(`/hr/payroll-requests${status ? `?status=${status}` : ''}`).then((r) => r.data),
  payrollRequestsForEmployee: (employeeId: number) =>
    api.get<PayrollRequest[]>(`/hr/employees/${employeeId}/payroll-requests`).then((r) => r.data),
  approvePayrollRequest: (id: number) =>
    api.post<PayrollRequest>(`/hr/payroll-requests/${id}/approve`).then((r) => r.data),
  rejectPayrollRequest: (id: number, remarks?: string) =>
    api.post<PayrollRequest>(`/hr/payroll-requests/${id}/reject`, { remarks }).then((r) => r.data),

  // Full hourly wage settings
  saveWageSettings: (employeeId: number, body: WageSettings) =>
    api.put<any>(`/hr/employees/${employeeId}/wage-settings`, body).then((r) => r.data),
  // Live what-if: the month's real hours priced with unsaved settings (nothing is saved)
  wagePreview: (employeeId: number, month: number, year: number, body: WageSettings) =>
    api.post<PayrollPreviewRow>(`/hr/employees/${employeeId}/wage-preview?month=${month}&year=${year}`, body).then((r) => r.data),

  // Hourly pay register — which employee earned how much this month
  hourlyPayRegister: (month: number, year: number) =>
    api.get<any>(`/hr/hourly-pay/register?month=${month}&year=${year}`).then((r) => r.data),
  setHourlyRate: (employeeId: number, hourlyRate?: number, overtimeMultiplier?: number) => {
    const q = new URLSearchParams();
    if (hourlyRate != null) q.set('hourlyRate', String(hourlyRate));
    if (overtimeMultiplier != null) q.set('overtimeMultiplier', String(overtimeMultiplier));
    return api.put<any>(`/hr/employees/${employeeId}/hourly-rate?${q.toString()}`).then((r) => r.data);
  },

  financeDashboard: () => api.get<FinanceDashboard>(`/hr/finance-dashboard`).then((r) => r.data),
  cashflow: (month: number, year: number) =>
    api.get<any>(`/hr/cashflow?month=${month}&year=${year}`).then((r) => r.data),
  report: (type: string, month?: number, year?: number) => {
    const q = new URLSearchParams();
    if (month) q.set('month', String(month));
    if (year) q.set('year', String(year));
    const qs = q.toString();
    return api.get<any>(`/hr/payroll-reports/${type}${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
  runAlerts: () => api.post<Record<string, number>>(`/hr/alerts/run`).then((r) => r.data),
};
