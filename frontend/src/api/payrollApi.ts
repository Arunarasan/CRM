import api from '../lib/api';
import {
  SalaryStructure, SalaryRecord, EmployeeAdvance, EmployeeLoan, FinanceDashboard,
  EmployeeDeduction, WageSettings,
} from '../types/payroll';

// Employee payroll — /api/hr endpoints. These return raw bodies (HrController is not wrapped in
// ApiResponse), so we read res.data directly.

export const payrollApi = {
  getStructure: (employeeId: number) =>
    api.get<SalaryStructure>(`/hr/salary-structure/${employeeId}`).then((r) => r.data),
  saveStructure: (employeeId: number, body: SalaryStructure) =>
    api.post<SalaryStructure>(`/hr/salary-structure/${employeeId}`, body).then((r) => r.data),

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

  runPayroll: (params: { employeeId: number; month: number; year: number; overtimeHours?: number; bonus?: number; incentive?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null) q.set(k, String(v)); });
    return api.post<SalaryRecord>(`/hr/payroll/run?${q.toString()}`).then((r) => r.data);
  },
  runPayrollBulk: (month: number, year: number) =>
    api.post<Record<string, unknown>>(`/hr/payroll/run-bulk?month=${month}&year=${year}`).then((r) => r.data),

  // Hourly payroll run — attendance + OT + approved bonuses − deductions.
  runHourlyPayroll: (params: { employeeId: number; month: number; year: number; bonus?: number; incentive?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null) q.set(k, String(v)); });
    return api.post<SalaryRecord>(`/hr/payroll/run-hourly?${q.toString()}`).then((r) => r.data);
  },
  runHourlyPayrollBulk: (month: number, year: number) =>
    api.post<Record<string, unknown>>(`/hr/payroll/run-hourly-bulk?month=${month}&year=${year}`).then((r) => r.data),
  approvePayroll: (salaryRecordId: number) =>
    api.post<SalaryRecord>(`/hr/payroll/${salaryRecordId}/approve`).then((r) => r.data),

  register: (month: number, year: number) =>
    api.get<SalaryRecord[]>(`/hr/payroll/register?month=${month}&year=${year}`).then((r) => r.data),
  payslip: (salaryRecordId: number) =>
    api.get<{ record: SalaryRecord; recoveries: any[] }>(`/hr/payslip/${salaryRecordId}`).then((r) => r.data),
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

  // Full hourly wage settings
  saveWageSettings: (employeeId: number, body: WageSettings) =>
    api.put<any>(`/hr/employees/${employeeId}/wage-settings`, body).then((r) => r.data),

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
  report: (type: string, month?: number, year?: number) => {
    const q = new URLSearchParams();
    if (month) q.set('month', String(month));
    if (year) q.set('year', String(year));
    const qs = q.toString();
    return api.get<any>(`/hr/payroll-reports/${type}${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
  runAlerts: () => api.post<Record<string, number>>(`/hr/alerts/run`).then((r) => r.data),
};
