// Employee payroll types — mirror backend SalaryStructure / SalaryRecord / EmployeeAdvance /
// EmployeeLoan and the /api/hr payroll endpoints.

export interface SalaryStructure {
  id?: number;
  basic: number;
  hra: number;
  allowances: number;
  specialAllowance: number;
  pfEnabled: boolean;
  pfPercentage: number;
  esiEnabled: boolean;
  professionalTax: number;
  overtimeHourlyRate: number;
  effectiveFrom?: string;
  active?: boolean;
}

export interface SalaryRecord {
  id: number;
  month: number;
  year: number;
  basic: number;
  hra: number;
  allowances: number;
  overtimeHours: number;
  overtimeAmount: number;
  bonus: number;
  incentive: number;
  grossEarnings: number;
  pfAmount: number;
  esiAmount: number;
  professionalTax: number;
  advanceRecovery: number;
  loanRecovery: number;
  leaveDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  workingDays?: number;
  paidDays?: number;
  lopDays?: number;
  payslipNumber?: string;
  status: string; // PENDING, APPROVED, PAID
  paymentDate?: string;
  employee?: any;
  // Hourly payslip breakdown (V25)
  payType?: string; // MONTHLY | HOURLY
  hourlyRate?: number;
  overtimeRate?: number;
  workedHours?: number;
  regularHours?: number;
  attendanceDays?: number;
  regularEarnings?: number;
  projectBonus?: number;
  manualBonus?: number;
  manualDeduction?: number;
  approvedAt?: string;
}

// Manual deduction (fine / damage / advance recovery / loan recovery / other).
export interface EmployeeDeduction {
  id?: number;
  employee?: any;
  deductionType: string;
  amount: number;
  reason?: string;
  deductionDate?: string;
  status?: string; // PENDING, APPROVED, APPLIED
  targetMonth?: number;
  targetYear?: number;
}

// An employee-raised money request (advance / one-off loan repayment / other) awaiting admin action.
export interface PayrollRequest {
  id: number;
  employee?: any;
  requestedBy?: any;
  requestType: 'ADVANCE' | 'LOAN_REPAYMENT' | 'ADVANCE_REPAYMENT' | 'SET_RECOVERY' | 'OTHER';
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  monthlyRecovery?: number | null;
  targetMonth?: number | null;
  targetYear?: number | null;
  loanId?: number | null;
  advanceId?: number | null;
  reason?: string;
  status: string; // PENDING | APPROVED | APPLIED | CONVERTED | REJECTED
  adminRemarks?: string;
  createdAt?: string;
}

// Full hourly wage settings (HR-managed).
export interface WageSettings {
  salaryType?: string;
  hourlyRate?: number | null;
  overtimeRate?: number | null;
  holidayRate?: number | null;
  weekendRate?: number | null;
  nightRate?: number | null;
  overtimeMultiplier?: number;
  weekendMultiplier?: number;
  holidayMultiplier?: number;
  nightMultiplier?: number;
  standardDailyHours?: number;
  maxDailyHours?: number | null;
  bonusEligible?: boolean;
  payrollCycle?: string;
  paymentMethod?: string | null;
  bankAccount?: string;
  ifsc?: string;
}

export interface EmployeeAdvance {
  id?: number;
  amount: number;
  reason?: string;
  advanceDate?: string;
  status?: string;
  monthlyRecovery: number;
  recoveredAmount?: number;
  balance?: number;
  remarks?: string;
}

export interface EmployeeLoan {
  id?: number;
  principal: number;
  emiAmount: number;
  tenureMonths?: number;
  disbursedDate?: string;
  status?: string;
  recoveredAmount?: number;
  balance?: number;
  remarks?: string;
}

export interface PayrollRecovery {
  id: number;
  sourceType: string;
  sourceId: number;
  amount: number;
}

export interface FinanceDashboard {
  employee: {
    payrollDue: number;
    salaryPaidThisMonth: number;
    salaryPaidYtd: number;
    advancesOutstanding: number;
    loansOutstanding: number;
  };
  contractor: {
    outstandingPayments: number;
    upcomingPayments: number;
    overduePayments: number;
    contractValue: number;
    paymentRequestsPendingApproval: number;
  };
}

// Unified pay run — one row per person (employee OR contractor) for a period.
// Mirrors backend dto/payroll/PayrollLine.
export interface PayrollLine {
  resourceType: 'EMPLOYEE' | 'CONTRACTOR';
  personId?: number;
  name?: string;
  code?: string;
  payModel: 'MONTHLY' | 'HOURLY' | 'CONTRACT';
  basisLabel?: string;
  gross?: number | null;
  deductions?: number | null;
  payable?: number;
  outstanding?: number | null; // contractor-only running balance (pending amount)
  billedTotal?: number | null; // contractor-only: total value billed (advances + regular)
  paidToDate?: number | null; // contractor-only: total paid so far, including advances
  status?: string; // PENDING · APPROVED · PAID (emp) | DUE · PENDING · PAID (con)
  recordId?: number | null; // salary record id for inline emp approve/pay
  actionHint?: 'APPROVE' | 'PAY' | 'VIEW' | 'OPEN_BILL' | 'LEDGER';
  month: number;
  year: number;
}

export interface PayrollSummary {
  month: number;
  year: number;
  totalPeople: number;
  employees: number;
  contractors: number;
  toApprove: number;
  toPay: number;
  paid: number;
  employeeNetPayout: number;
  contractorOutstanding: number;
  combinedPayout: number;
}

// Unified /api/workforce/{id}/finance response.
export interface WorkforceFinance {
  workforceType: string;
  fullName: string;
  // employee
  employeeId?: number;
  structure?: SalaryStructure;
  payslips?: SalaryRecord[];
  advances?: EmployeeAdvance[];
  loans?: EmployeeLoan[];
  // contractor
  contractorId?: number;
  contractDetails?: {
    agreementNumber?: string;
    contractStartDate?: string;
    contractEndDate?: string;
    paymentTerms?: string;
    gstNumber?: string;
    panNumber?: string;
  };
  summary?: {
    billedOutstanding?: number;
    retentionHeld?: number;
    totalPaid?: number;
    advancesPaid?: number;
    ledgerBalance?: number;
  };
  paymentRequests?: any[];
  paymentHistory?: any[];
  projectWise?: { projectId: number; projectName: string; contractValue: number; paid: number; pending: number; status: string }[];
}
