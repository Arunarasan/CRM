import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { payrollApi } from "@/api/payrollApi";
import type { FinanceDashboard, EmployeeDeduction, WageSettings, PayrollLine, PayrollSummary, PayrollRequest } from "@/types/payroll";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import { useAuth } from "@/hooks/useAuth";
import QuickPayDialog from "./QuickPayDialog";
import api from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, PlayCircle, Clock, Gift, Plus, Check, BadgeIndianRupee, Search,
  Settings2, MinusCircle, FileText, Wallet, CircleHelp, ExternalLink, Zap, ArrowLeftRight,
} from "lucide-react";

const BONUS_TYPES = [
  "PROJECT_COMPLETION", "QUALITY", "PERFORMANCE", "TARGET_ACHIEVEMENT",
  "FESTIVAL", "ATTENDANCE", "MANUAL", "INCENTIVE", "OTHER",
];
const BONUS_LABEL: Record<string, string> = {
  PROJECT_COMPLETION: "Project Completion", QUALITY: "Quality", PERFORMANCE: "Performance",
  TARGET_ACHIEVEMENT: "Target Achievement", FESTIVAL: "Festival", ATTENDANCE: "Attendance",
  MANUAL: "Manual", INCENTIVE: "Incentive", OTHER: "Other",
};
const DEDUCTION_TYPES = ["FINE", "DAMAGE", "ADVANCE_RECOVERY", "LOAN_RECOVERY", "OTHER"];
const DEDUCTION_LABEL: Record<string, string> = {
  FINE: "Fine", DAMAGE: "Damage Recovery", ADVANCE_RECOVERY: "Advance Recovery",
  LOAN_RECOVERY: "Loan Recovery", OTHER: "Other",
};

const REQUEST_LABEL: Record<string, string> = {
  ADVANCE: "Salary Advance", LOAN_REPAYMENT: "Loan Repayment", ADVANCE_REPAYMENT: "Advance Repayment",
  SET_RECOVERY: "Recovery Plan", OTHER: "Other",
};
const MONTHS_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const empName = (e: any) => (e ? [e.firstName, e.lastName].filter(Boolean).join(" ") || e.name : "") || "Employee";
const num = (v: any) => Number(v || 0);

const STATUS_TONE: Record<string, string> = {
  RECOMMENDED: "bg-purple-100 text-purple-700", PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700", PAID: "bg-emerald-100 text-emerald-700",
  APPLIED: "bg-slate-200 text-slate-700", DUE: "bg-rose-100 text-rose-700",
  CONVERTED: "bg-teal-100 text-teal-700", REJECTED: "bg-rose-100 text-rose-700",
};

const EMP_STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "To approve" },
  { key: "APPROVED", label: "To pay" },
  { key: "PAID", label: "Paid" },
];

export default function HrFinanceDashboard() {
  // Who may actually pay/approve/award/deduct/run — mirrors the backend PAYROLL_PROCESS gate
  // (ROLE_ADMIN or PAYROLL_PROCESS or PAYROLL_WRITE). Read-only viewers (WORKFORCE_READ) see
  // the numbers but none of the action controls. UI gating only; @PreAuthorize is enforcement.
  const { hasAnyAuthority } = useAuth();
  const canProcess = hasAnyAuthority(["PAYROLL_PROCESS", "PAYROLL_WRITE"]);
  const canPayContractor = hasAnyAuthority(["CONTRACTOR_PAYMENT"]);
  const [quickOpen, setQuickOpen] = useState(false);

  const [d, setD] = useState<FinanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [running, setRunning] = useState(false);

  const [hourly, setHourly] = useState<any | null>(null);
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [psum, setPsum] = useState<PayrollSummary | null>(null);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<EmployeeDeduction[]>([]);
  const [payReqs, setPayReqs] = useState<PayrollRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // table search / filters
  const [empSearch, setEmpSearch] = useState("");
  const [empStatus, setEmpStatus] = useState("ALL");
  const [conSearch, setConSearch] = useState("");

  const [awardOpen, setAwardOpen] = useState(false);
  const [award, setAward] = useState({ employeeId: "", bonusType: "PROJECT_COMPLETION", amount: "", projectId: "", reason: "" });
  const [dedOpen, setDedOpen] = useState(false);
  const [ded, setDed] = useState({ employeeId: "", deductionType: "FINE", amount: "", reason: "" });
  const [wageOpen, setWageOpen] = useState(false);
  const [wage, setWage] = useState<any>({ employeeId: "" });

  const load = () => {
    setLoading(true);
    payrollApi.financeDashboard().then(setD).catch(console.error).finally(() => setLoading(false));
  };
  const loadHourly = () => payrollApi.hourlyPayRegister(month, year).then(setHourly).catch(() => setHourly(null));
  const loadUnified = () => {
    payrollApi.unifiedRegister(month, year).then(setLines).catch(() => setLines([]));
    payrollApi.payrollSummary(month, year).then(setPsum).catch(() => setPsum(null));
  };
  const loadBonuses = () => payrollApi.allBonuses().then(setBonuses).catch(() => setBonuses([]));
  const loadDeductions = () => payrollApi.allDeductions().then(setDeductions).catch(() => setDeductions([]));
  const loadPayReqs = () => payrollApi.payrollRequests().then(setPayReqs).catch(() => setPayReqs([]));
  const reloadEmployees = () => api.get(`/hr/employees?size=500`).then(r => setEmployees(r.data.content || [])).catch(() => {});

  useEffect(() => {
    load(); loadBonuses(); loadDeductions(); loadPayReqs(); reloadEmployees();
    api.get(`/projects?size=500`).then(r => setProjects(r.data.content || [])).catch(() => {});
  }, []);
  useEffect(() => { loadHourly(); loadUnified(); }, [month, year]);

  const empLines = useMemo(() => lines.filter((l) => l.resourceType === "EMPLOYEE"), [lines]);
  const conLines = useMemo(() => lines.filter((l) => l.resourceType === "CONTRACTOR"), [lines]);

  const empStatusCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: empLines.length, PENDING: 0, APPROVED: 0, PAID: 0 };
    empLines.forEach((l) => { const s = l.status || ""; if (c[s] != null) c[s]++; });
    return c;
  }, [empLines]);

  const filteredEmp = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return empLines.filter((l) => {
      if (empStatus !== "ALL" && (l.status || "") !== empStatus) return false;
      if (!q) return true;
      return (l.name || "").toLowerCase().includes(q) || (l.code || "").toLowerCase().includes(q);
    });
  }, [empLines, empSearch, empStatus]);

  const filteredCon = useMemo(() => {
    const q = conSearch.trim().toLowerCase();
    if (!q) return conLines;
    return conLines.filter((l) => (l.name || "").toLowerCase().includes(q) || (l.code || "").toLowerCase().includes(q));
  }, [conLines, conSearch]);

  const conTotals = useMemo(() => filteredCon.reduce(
    (acc, l) => ({
      billed: acc.billed + num(l.billedTotal),
      paid: acc.paid + num(l.paidToDate),
      pending: acc.pending + num(l.outstanding),
    }),
    { billed: 0, paid: 0, pending: 0 },
  ), [filteredCon]);

  const pendingReqCount = useMemo(() => payReqs.filter((r) => r.status === "PENDING").length, [payReqs]);

  const generateHourly = () => {
    setRunning(true);
    payrollApi.runHourlyPayrollBulk(month, year)
      .then((r: any) => { toast.success(`Hourly payroll — ${r.generated} generated for hourly-basis staff, ${r.skipped} skipped (monthly-basis or already done).`); loadUnified(); load(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to generate payroll"))
      .finally(() => setRunning(false));
  };
  const runBulk = () => {
    setRunning(true);
    payrollApi.runPayrollBulk(month, year)
      .then((r: any) => { toast.success(`Monthly payroll — ${r.generated} generated for monthly-basis staff, ${r.skipped} skipped (hourly-basis or already done).`); load(); loadUnified(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to run monthly payroll"))
      .finally(() => setRunning(false));
  };
  const runAlerts = () => {
    payrollApi.runAlerts()
      .then((r: any) => toast.success(`Alerts sent — ${r.overduePayments} overdue, ${r.finalPaymentsPending} final pending, ${r.contractsClosedWithBalance} closed w/ balance.`))
      .catch(() => toast.error("Failed to send alerts"));
  };
  const approveRec = (id: number) => payrollApi.approvePayroll(id).then(() => { toast.success("Payslip approved."); loadUnified(); }).catch((e) => toast.error(e?.response?.data?.message || "Failed"));
  const payRec = (id: number) => payrollApi.markPaid(id).then(() => { toast.success("Marked as paid."); loadUnified(); load(); }).catch((e) => toast.error(e?.response?.data?.message || "Failed"));
  const toggleBasis = (employeeId: number | undefined, current?: string) => {
    if (!employeeId) return;
    const next = current === "HOURLY" ? "MONTHLY" : "HOURLY";
    payrollApi.setPayBasis(employeeId, next)
      .then(() => { toast.success(`Pay basis set to ${next === "HOURLY" ? "Hourly" : "Monthly"} — applies to the next payroll run.`); reloadEmployees(); loadUnified(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to change pay basis"));
  };

  const submitAward = () => {
    if (!award.employeeId) { toast.error("Select an employee to award the bonus to."); return; }
    if (!award.amount || Number(award.amount) <= 0) { toast.error("Enter a bonus amount greater than zero."); return; }
    payrollApi.awardBonus(Number(award.employeeId), {
      bonusType: award.bonusType, amount: Number(award.amount),
      reason: award.reason || undefined, project: award.projectId ? { id: Number(award.projectId) } : undefined,
    })
      .then(() => {
        setAwardOpen(false);
        setAward({ employeeId: "", bonusType: "PROJECT_COMPLETION", amount: "", projectId: "", reason: "" });
        toast.success("Bonus awarded."); loadBonuses();
      })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to award bonus"));
  };

  const submitDeduction = () => {
    if (!ded.employeeId) { toast.error("Select an employee for the deduction."); return; }
    if (!ded.amount || Number(ded.amount) <= 0) { toast.error("Enter a deduction amount greater than zero."); return; }
    payrollApi.createDeduction(Number(ded.employeeId), {
      deductionType: ded.deductionType, amount: Number(ded.amount), reason: ded.reason || undefined,
    })
      .then(() => { setDedOpen(false); setDed({ employeeId: "", deductionType: "FINE", amount: "", reason: "" }); toast.success("Deduction added."); loadDeductions(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to add deduction"));
  };

  const openWage = () => { setWage({ employeeId: "" }); setWageOpen(true); };
  const onWageEmployee = (id: string) => {
    const e = employees.find((x) => String(x.id) === id) || {};
    setWage({
      employeeId: id,
      salaryType: e.salaryType || "HOURLY",
      hourlyRate: e.hourlyRate ?? "", overtimeRate: e.overtimeRate ?? "", holidayRate: e.holidayRate ?? "",
      weekendRate: e.weekendRate ?? "", nightRate: e.nightRate ?? "",
      overtimeMultiplier: e.overtimeMultiplier ?? "1.5", standardDailyHours: e.standardDailyHours ?? "8",
      maxDailyHours: e.maxDailyHours ?? "", bonusEligible: e.bonusEligible ?? true,
      payrollCycle: e.payrollCycle ?? "MONTHLY", paymentMethod: e.paymentMethod ?? "",
      bankAccount: e.bankAccount ?? "", ifsc: e.ifsc ?? "",
    });
  };
  const submitWage = () => {
    if (!wage.employeeId) { toast.error("Select an employee."); return; }
    const numOrNull = (v: any) => (v === "" || v == null ? null : Number(v));
    const body: WageSettings = {
      salaryType: wage.salaryType || "HOURLY",
      hourlyRate: numOrNull(wage.hourlyRate), overtimeRate: numOrNull(wage.overtimeRate),
      holidayRate: numOrNull(wage.holidayRate), weekendRate: numOrNull(wage.weekendRate),
      nightRate: numOrNull(wage.nightRate),
      overtimeMultiplier: wage.overtimeMultiplier ? Number(wage.overtimeMultiplier) : undefined,
      standardDailyHours: wage.standardDailyHours ? Number(wage.standardDailyHours) : undefined,
      maxDailyHours: numOrNull(wage.maxDailyHours), bonusEligible: !!wage.bonusEligible,
      payrollCycle: wage.payrollCycle || "MONTHLY", paymentMethod: wage.paymentMethod || null,
      bankAccount: wage.bankAccount || undefined, ifsc: wage.ifsc || undefined,
    };
    payrollApi.saveWageSettings(Number(wage.employeeId), body)
      .then(() => { setWageOpen(false); toast.success("Wage settings saved."); loadHourly(); reloadEmployees(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to save wage settings"));
  };

  if (loading || !d) return <div className="p-6 text-muted-foreground">Loading payroll…</div>;

  const inputCls = "w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      {/* ---- STICKY ACTION BAR — period + run + quick actions stay in reach while scrolling ---- */}
      <div className="sticky top-0 z-20 bg-slate-50 pt-1 pb-2">
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 via-white to-white p-4 md:p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-500">Payroll period</div>
              <div className="mt-1.5 flex items-center gap-2">
                <select
                  className="h-11 rounded-lg border bg-white px-3 text-lg font-bold text-slate-900 shadow-sm"
                  value={month} onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {MONTHS.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <Input type="number" className="h-11 w-24 text-lg font-bold" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <span><b className="text-slate-900">{psum?.employees ?? 0}</b> employees</span>
                <Dot />
                <span><b className="text-slate-900">{psum?.contractors ?? 0}</b> contractors</span>
                <Dot />
                <span className="text-amber-600"><b>{psum?.toApprove ?? 0}</b> to approve</span>
                <Dot />
                <span className="text-emerald-600"><b>{psum?.toPay ?? 0}</b> to pay</span>
                <Dot />
                <span>Payout <b className="text-slate-900">{inr(psum?.combinedPayout)}</b></span>
              </div>
            </div>

            {canProcess ? (
              <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" onClick={generateHourly} disabled={running} className="shadow-sm flex-1 md:flex-none">
                    <PlayCircle className={`w-5 h-5 mr-2 ${running ? "animate-pulse" : ""}`} />
                    {running ? "Generating…" : "Run hourly pay"}
                  </Button>
                  <Button size="lg" variant="secondary" onClick={runBulk} disabled={running} className="shadow-sm flex-1 md:flex-none">
                    <Wallet className="w-5 h-5 mr-2" /> Run monthly salary
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setQuickOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 flex-1 md:flex-none"><Zap className="w-4 h-4 mr-1.5" /> Quick Pay</Button>
                  <Button variant="outline" size="sm" onClick={openWage} className="flex-1 md:flex-none"><Settings2 className="w-4 h-4 mr-1.5" /> Wage &amp; basis</Button>
                  <Button variant="outline" size="sm" onClick={runAlerts} className="flex-1 md:flex-none"><Bell className="w-4 h-4 mr-1.5" /> Alerts</Button>
                </div>
              </div>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">View only</span>
            )}
          </div>
          <p className="mt-3 hidden md:flex items-center gap-1.5 text-xs text-slate-400">
            <CircleHelp className="w-3.5 h-3.5" />
            {canProcess
              ? `"Run hourly pay" builds payslips from hours × rate (+ bonuses & incentives); "Run monthly salary" uses each employee's salary structure. Each employee runs on the basis set in Wage & basis. Running again only fills anyone missed — nobody is paid twice.`
              : `You can review payroll for ${monthName(month)} ${year}. Approving and paying require payroll-processing rights.`}
          </p>
        </div>
      </div>

      {/* ---- MONEY AT A GLANCE ---- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile label="Payroll due" value={inr(d.employee.payrollDue)} tone="amber" />
        <Tile label="Paid this month" value={inr(d.employee.salaryPaidThisMonth)} />
        <Tile label="Advances outstanding" value={inr(d.employee.advancesOutstanding)} />
        <Tile label="Loans outstanding" value={inr(d.employee.loansOutstanding)} />
        <Tile label="Contractor outstanding" value={inr(d.contractor.outstandingPayments)} tone="amber" />
        <Tile label="Contractor overdue" value={inr(d.contractor.overduePayments)} tone="rose" />
      </div>

      {/* ---- TABS — one focused section at a time ---- */}
      <Tabs defaultValue="salary" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="salary">Salary <CountPill n={empLines.length} /></TabsTrigger>
          <TabsTrigger value="contractors">Contractors <CountPill n={conLines.length} /></TabsTrigger>
          <TabsTrigger value="adjustments">Bonuses &amp; Deductions</TabsTrigger>
          <TabsTrigger value="requests">Requests {pendingReqCount > 0 && <CountPill n={pendingReqCount} tone="amber" />}</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* ===================== SALARY ===================== */}
        <TabsContent value="salary" className="mt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="flex items-center gap-2 font-bold text-slate-800">
              <BadgeIndianRupee className="w-5 h-5 text-emerald-600" /> Employee salary — {monthName(month)} {year}
            </h3>
            <span className="text-xs font-semibold text-slate-500">{filteredEmp.length} of {empLines.length}</span>
          </div>

          {/* search + status filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 px-3 h-10 rounded-md border bg-white sm:max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400" />
              <input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Search employee by name or code…" className="flex-1 bg-transparent text-sm outline-none" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EMP_STATUS_FILTERS.map((f) => (
                <button key={f.key} type="button" onClick={() => setEmpStatus(f.key)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors ${empStatus === f.key ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {f.label}<span className="ml-1 opacity-70">{empStatusCounts[f.key] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {canProcess && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Tap an employee’s <b className="mx-0.5">Type</b> to switch Hourly ↔ Monthly — applies from the next run.
            </p>
          )}

          {/* desktop table */}
          <div className="hidden md:block bg-white border rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                <tr>
                  <th className="text-left p-3">Employee</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Basis</th>
                  <th className="text-right p-3">Gross</th>
                  <th className="text-right p-3">Deductions</th>
                  <th className="text-right p-3">Net payable</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmp.map((l, i) => (
                  <tr key={`emp-${l.personId}-${i}`} className="border-t hover:bg-slate-50/70">
                    <td className="p-3"><PersonCell line={l} /></td>
                    <td className="p-3">
                      {canProcess
                        ? <BasisToggle model={l.payModel} onToggle={() => toggleBasis(l.personId, l.payModel)} />
                        : <PayTypeTag model={l.payModel} />}
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">{l.basisLabel || "—"}</td>
                    <td className="p-3 text-right text-slate-700">{l.gross != null ? inr(l.gross) : "—"}</td>
                    <td className="p-3 text-right text-rose-600">{l.deductions != null && num(l.deductions) > 0 ? `− ${inr(l.deductions)}` : "—"}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">{inr(l.payable)}</td>
                    <td className="p-3 text-center"><StatusBadge status={l.status} /></td>
                    <td className="p-3 text-right whitespace-nowrap"><RowAction line={l} onApprove={approveRec} onPay={payRec} canProcess={canProcess} /></td>
                  </tr>
                ))}
                {filteredEmp.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-slate-400 py-12">
                    <p className="font-medium text-slate-500">No employees match.</p>
                    <p className="text-xs mt-1">Adjust the search/filter, or run payroll to build payslips from attendance.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div className="md:hidden space-y-2">
            {filteredEmp.map((l, i) => (
              <EmpCard key={`empc-${l.personId}-${i}`} l={l} canProcess={canProcess}
                onToggle={() => toggleBasis(l.personId, l.payModel)} onApprove={approveRec} onPay={payRec} />
            ))}
            {filteredEmp.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No employees match.</p>}
          </div>
        </TabsContent>

        {/* ===================== CONTRACTORS ===================== */}
        <TabsContent value="contractors" className="mt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="flex items-center gap-2 font-bold text-slate-800">
              <Wallet className="w-5 h-5 text-amber-600" /> Contractor payments
            </h3>
            <span className="text-xs font-semibold text-slate-500">{filteredCon.length} of {conLines.length}</span>
          </div>

          <div className="flex items-center gap-2 px-3 h-10 rounded-md border bg-white sm:max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={conSearch} onChange={(e) => setConSearch(e.target.value)}
              placeholder="Search contractor by name or code…" className="flex-1 bg-transparent text-sm outline-none" />
          </div>

          {/* desktop table */}
          <div className="hidden md:block bg-white border rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                <tr>
                  <th className="text-left p-3">Contractor</th>
                  <th className="text-left p-3">This period</th>
                  <th className="text-right p-3">Total billed</th>
                  <th className="text-right p-3">Paid so far</th>
                  <th className="text-right p-3">Pending</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCon.map((l, i) => (
                  <tr key={`con-${l.personId}-${i}`} className="border-t hover:bg-slate-50/70">
                    <td className="p-3"><PersonCell line={l} /></td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">{l.basisLabel || "—"}</td>
                    <td className="p-3 text-right text-slate-700">{inr(l.billedTotal)}</td>
                    <td className="p-3 text-right text-emerald-600">{inr(l.paidToDate)}</td>
                    <td className="p-3 text-right font-bold text-amber-700">{num(l.outstanding) > 0 ? inr(l.outstanding) : "—"}</td>
                    <td className="p-3 text-center"><StatusBadge status={l.status} /></td>
                    <td className="p-3 text-right whitespace-nowrap"><RowAction line={l} onApprove={approveRec} onPay={payRec} canProcess={canProcess} /></td>
                  </tr>
                ))}
                {filteredCon.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-12">
                    <p className="font-medium text-slate-500">No contractor balances to show.</p>
                    <p className="text-xs mt-1">A contractor appears here once they carry an open bill balance.</p>
                  </td></tr>
                )}
              </tbody>
              {filteredCon.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-slate-50 font-bold text-slate-700">
                    <td className="p-3" colSpan={2}>Total</td>
                    <td className="p-3 text-right">{inr(conTotals.billed)}</td>
                    <td className="p-3 text-right text-emerald-700">{inr(conTotals.paid)}</td>
                    <td className="p-3 text-right text-amber-700">{inr(conTotals.pending)}</td>
                    <td className="p-3" colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* mobile cards */}
          <div className="md:hidden space-y-2">
            {filteredCon.map((l, i) => <ConCard key={`conc-${l.personId}-${i}`} l={l} />)}
            {filteredCon.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No contractor balances to show.</p>}
          </div>

          <p className="text-xs text-slate-400">
            <b>Paid so far</b> includes advances; <b>Pending</b> is the open balance across all their bills. Rows link out to the bill or ledger rather than paying inline.
          </p>
        </TabsContent>

        {/* ===================== BONUSES & DEDUCTIONS ===================== */}
        <TabsContent value="adjustments" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* BONUSES */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="flex items-center gap-2 font-bold text-slate-800"><Gift className="w-5 h-5 text-pink-600" /> Bonuses</h3>
                {canProcess && (
                <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Award</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Award Bonus</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Employee</Label>
                        <select className={inputCls} value={award.employeeId} onChange={(e) => setAward({ ...award, employeeId: e.target.value })}>
                          <option value="">Select employee…</option>
                          {employees.map((e: any) => <option key={e.id} value={e.id}>{empName(e)} {e.employeeCode ? `(${e.employeeCode})` : ""}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Bonus Type</Label>
                          <select className={inputCls} value={award.bonusType} onChange={(e) => setAward({ ...award, bonusType: e.target.value })}>
                            {BONUS_TYPES.map((t) => <option key={t} value={t}>{BONUS_LABEL[t]}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={award.amount} onChange={(e) => setAward({ ...award, amount: e.target.value })} /></div>
                      </div>
                      <div className="space-y-2">
                        <Label>Project (optional)</Label>
                        <select className={inputCls} value={award.projectId} onChange={(e) => setAward({ ...award, projectId: e.target.value })}>
                          <option value="">No project</option>
                          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.projectName || p.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2"><Label>Reason / Note</Label><Input value={award.reason} onChange={(e) => setAward({ ...award, reason: e.target.value })} placeholder="e.g. On-time completion of Villa project" /></div>
                      <Button className="w-full" onClick={submitAward}>Award Bonus</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                )}
              </div>
              <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="text-left p-3">Employee</th>
                      <th className="text-left p-3">Reason</th>
                      <th className="text-right p-3">Amount</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-right p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map((b: any) => (
                      <tr key={b.id} className="border-t">
                        <td className="p-3"><EmpLink id={b.employee?.id} name={empName(b.employee)} code={b.employee?.employeeCode} /></td>
                        <td className="p-3 text-slate-600">
                          <div className="text-[11px] font-semibold text-slate-400">{BONUS_LABEL[b.bonusType] || b.bonusType}</div>
                          {b.project?.projectName || b.reason || "—"}
                        </td>
                        <td className="p-3 text-right font-bold">{inr(b.amount)}</td>
                        <td className="p-3 text-center"><StatusBadge status={b.status} /></td>
                        <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                          {canProcess && (b.status === "PENDING" || b.status === "RECOMMENDED") && <Button size="sm" variant="outline" onClick={() => payrollApi.approveBonus(b.id).then(() => { toast.success("Bonus approved."); loadBonuses(); })}><Check className="w-3.5 h-3.5" /></Button>}
                          {canProcess && b.status !== "PAID" && <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => payrollApi.payBonus(b.id).then(() => { toast.success("Bonus marked paid."); loadBonuses(); })}><BadgeIndianRupee className="w-3.5 h-3.5" /></Button>}
                          {!canProcess && <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))}
                    {bonuses.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-10">No bonuses awarded yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DEDUCTIONS */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="flex items-center gap-2 font-bold text-slate-800"><MinusCircle className="w-5 h-5 text-rose-600" /> Deductions</h3>
                {canProcess && (
                <Dialog open={dedOpen} onOpenChange={setDedOpen}>
                  <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" /> Add</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Manual Deduction</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Employee</Label>
                        <select className={inputCls} value={ded.employeeId} onChange={(e) => setDed({ ...ded, employeeId: e.target.value })}>
                          <option value="">Select employee…</option>
                          {employees.map((e: any) => <option key={e.id} value={e.id}>{empName(e)} {e.employeeCode ? `(${e.employeeCode})` : ""}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <select className={inputCls} value={ded.deductionType} onChange={(e) => setDed({ ...ded, deductionType: e.target.value })}>
                            {DEDUCTION_TYPES.map((t) => <option key={t} value={t}>{DEDUCTION_LABEL[t]}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={ded.amount} onChange={(e) => setDed({ ...ded, amount: e.target.value })} /></div>
                      </div>
                      <div className="space-y-2"><Label>Reason</Label><Input value={ded.reason} onChange={(e) => setDed({ ...ded, reason: e.target.value })} placeholder="e.g. Damaged equipment" /></div>
                      <Button className="w-full" onClick={submitDeduction}>Add Deduction</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                )}
              </div>
              <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="text-left p-3">Employee</th>
                      <th className="text-left p-3">Reason</th>
                      <th className="text-right p-3">Amount</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-right p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductions.map((b: any) => (
                      <tr key={b.id} className="border-t">
                        <td className="p-3"><EmpLink id={b.employee?.id} name={empName(b.employee)} code={b.employee?.employeeCode} /></td>
                        <td className="p-3 text-slate-600">
                          <div className="text-[11px] font-semibold text-slate-400">{DEDUCTION_LABEL[b.deductionType] || b.deductionType}</div>
                          {b.reason || "—"}
                        </td>
                        <td className="p-3 text-right font-bold text-rose-600">{inr(b.amount)}</td>
                        <td className="p-3 text-center"><StatusBadge status={b.status} /></td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {canProcess && b.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => payrollApi.approveDeduction(b.id).then(() => { toast.success("Deduction approved."); loadDeductions(); })}><Check className="w-3.5 h-3.5" /></Button>}
                        </td>
                      </tr>
                    ))}
                    {deductions.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-10">No manual deductions.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===================== REQUESTS ===================== */}
        <TabsContent value="requests" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 font-bold text-slate-800">
              <BadgeIndianRupee className="w-5 h-5 text-emerald-600" /> Employee Requests
              {pendingReqCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{pendingReqCount} pending</span>
              )}
            </h3>
          </div>
          <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                <tr>
                  <th className="text-left p-3">Employee</th>
                  <th className="text-left p-3">Request</th>
                  <th className="text-left p-3">For</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {payReqs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3"><EmpLink id={r.employee?.id} name={empName(r.employee)} code={r.employee?.employeeCode} /></td>
                    <td className="p-3 text-slate-600">
                      <div className="text-[11px] font-semibold text-slate-400">
                        {REQUEST_LABEL[r.requestType] || r.requestType}
                        {r.requestType === "OTHER" && r.direction === "CREDIT" ? " · reimbursement" : ""}
                      </div>
                      {r.reason || "—"}
                    </td>
                    <td className="p-3 text-slate-600">{r.targetMonth ? `${MONTHS_SHORT[r.targetMonth]} ${r.targetYear}` : "—"}</td>
                    <td className={`p-3 text-right font-bold ${r.requestType === "OTHER" && r.direction === "CREDIT" ? "text-emerald-600" : "text-rose-600"}`}>{inr(r.amount)}</td>
                    <td className="p-3 text-center"><StatusBadge status={r.status} /></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {canProcess && r.status === "PENDING" && (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => payrollApi.approvePayrollRequest(r.id).then(() => { toast.success("Request approved."); loadPayReqs(); load(); }).catch((e) => toast.error(e?.response?.data?.message || "Failed to approve"))}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => { const remarks = window.prompt("Reason for rejection (optional):") ?? undefined; payrollApi.rejectPayrollRequest(r.id, remarks).then(() => { toast.success("Request rejected."); loadPayReqs(); }).catch((e) => toast.error(e?.response?.data?.message || "Failed to reject")); }}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {payReqs.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">No employee requests.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Approving an advance creates a recoverable advance; loan repayments and other adjustments are applied to the target month's payroll run.
          </p>
        </TabsContent>

        {/* ===================== PREVIEW ===================== */}
        <TabsContent value="preview" className="mt-4">
          <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-3">
            <Clock className="w-5 h-5 text-cyan-600" /> Preview from attendance
            <span className="text-xs font-normal text-slate-400">(what a run would pay, before generating)</span>
          </h3>
          <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                <tr>
                  <th className="text-left p-3">Employee</th>
                  <th className="text-right p-3">Rate/hr</th>
                  <th className="text-right p-3">Worked hrs</th>
                  <th className="text-right p-3">OT hrs</th>
                  <th className="text-right p-3">Days</th>
                  <th className="text-right p-3">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {(hourly?.rows || []).map((r: any) => (
                  <tr key={r.employeeId} className="border-t">
                    <td className="p-3"><EmpLink id={r.employeeId} name={r.employeeName} code={r.employeeCode} /></td>
                    <td className="p-3 text-right">{inr(r.hourlyRate)}</td>
                    <td className="p-3 text-right">{num(r.workedHours).toFixed(1)}</td>
                    <td className="p-3 text-right">{num(r.overtimeHours).toFixed(1)}</td>
                    <td className="p-3 text-right text-slate-500">{r.daysPresent}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">{inr(r.earnings)}</td>
                  </tr>
                ))}
                {(!hourly?.rows || hourly.rows.length === 0) && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-10">No hourly-paid employees with recorded hours this month.</td></tr>
                )}
              </tbody>
              {hourly?.rows?.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-slate-50 font-bold">
                    <td className="p-3" colSpan={5}>Total ({hourly.employeeCount} employees)</td>
                    <td className="p-3 text-right text-emerald-700">{inr(hourly.totalEarnings)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* WAGE SETTINGS DIALOG */}
      <Dialog open={wageOpen} onOpenChange={setWageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Wage &amp; Pay Basis</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Employee</Label>
              <select className={inputCls} value={wage.employeeId} onChange={(e) => onWageEmployee(e.target.value)}>
                <option value="">Select employee…</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{empName(e)} {e.employeeCode ? `(${e.employeeCode})` : ""}</option>)}
              </select>
            </div>
            {wage.employeeId && (
              <>
                <div className="space-y-2">
                  <Label>Pay basis</Label>
                  <select className={inputCls} value={wage.salaryType || "HOURLY"} onChange={(e) => setWage({ ...wage, salaryType: e.target.value })}>
                    <option value="HOURLY">Hourly — paid by attendance hours × rate</option>
                    <option value="MONTHLY">Monthly — paid by salary structure</option>
                  </select>
                  <p className="text-xs text-slate-400">
                    {wage.salaryType === "MONTHLY"
                      ? "This employee is generated by “Run monthly salary” using their salary structure. The hourly rates below are ignored."
                      : "This employee is generated by “Run hourly pay” from the rates below."}
                  </p>
                </div>
                <div className={`grid grid-cols-2 gap-3 ${wage.salaryType === "MONTHLY" ? "opacity-50" : ""}`}>
                  <Field label="Hourly Rate (₹)"><Input type="number" value={wage.hourlyRate} onChange={(e) => setWage({ ...wage, hourlyRate: e.target.value })} /></Field>
                  <Field label="Overtime Rate (₹/hr)"><Input type="number" value={wage.overtimeRate} onChange={(e) => setWage({ ...wage, overtimeRate: e.target.value })} placeholder="blank = rate × OT mult" /></Field>
                  <Field label="Weekend Rate (₹/hr)"><Input type="number" value={wage.weekendRate} onChange={(e) => setWage({ ...wage, weekendRate: e.target.value })} placeholder="optional" /></Field>
                  <Field label="Holiday Rate (₹/hr)"><Input type="number" value={wage.holidayRate} onChange={(e) => setWage({ ...wage, holidayRate: e.target.value })} placeholder="optional" /></Field>
                  <Field label="Night Rate (₹/hr)"><Input type="number" value={wage.nightRate} onChange={(e) => setWage({ ...wage, nightRate: e.target.value })} placeholder="optional" /></Field>
                  <Field label="OT Multiplier"><Input type="number" value={wage.overtimeMultiplier} onChange={(e) => setWage({ ...wage, overtimeMultiplier: e.target.value })} /></Field>
                  <Field label="Standard Daily Hours"><Input type="number" value={wage.standardDailyHours} onChange={(e) => setWage({ ...wage, standardDailyHours: e.target.value })} /></Field>
                  <Field label="Max Daily Hours"><Input type="number" value={wage.maxDailyHours} onChange={(e) => setWage({ ...wage, maxDailyHours: e.target.value })} placeholder="optional cap" /></Field>
                  <Field label="Payroll Cycle">
                    <select className={inputCls} value={wage.payrollCycle} onChange={(e) => setWage({ ...wage, payrollCycle: e.target.value })}>
                      {["MONTHLY", "WEEKLY", "BIWEEKLY"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Payment Method">
                    <select className={inputCls} value={wage.paymentMethod} onChange={(e) => setWage({ ...wage, paymentMethod: e.target.value })}>
                      <option value="">—</option>
                      {["BANK_TRANSFER", "CASH", "CHEQUE", "UPI"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                    </select>
                  </Field>
                  <Field label="Bank Account"><Input value={wage.bankAccount} onChange={(e) => setWage({ ...wage, bankAccount: e.target.value })} /></Field>
                  <Field label="IFSC"><Input value={wage.ifsc} onChange={(e) => setWage({ ...wage, ifsc: e.target.value })} /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={!!wage.bonusEligible} onChange={(e) => setWage({ ...wage, bonusEligible: e.target.checked })} /> Eligible for bonuses
                </label>
                <Button className="w-full" onClick={submitWage}>Save Wage Settings</Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QUICK PAY — search anyone and pay inline */}
      {canProcess && (
        <QuickPayDialog
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          employees={employees}
          canPayContractor={canPayContractor}
          onDone={() => { loadUnified(); load(); loadBonuses(); loadDeductions(); loadPayReqs(); }}
        />
      )}
    </div>
  );
}

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthName(m: number) { return MONTHS[m] || String(m); }

function Dot() { return <span className="text-slate-300">•</span>; }

function CountPill({ n, tone }: { n: number; tone?: "amber" }) {
  return (
    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tone === "amber" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}>{n}</span>
  );
}

/** Clickable employee cell — opens the employee's full HR record. */
function EmpLink({ id, name, code }: { id?: number; name?: string; code?: string }) {
  if (!id && !name) return <span className="text-slate-400">—</span>;
  const initials = (name || "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const body = (
    <>
      <span className="w-8 h-8 shrink-0 rounded-full bg-slate-100 grid place-items-center text-[11px] font-bold text-slate-500">{initials}</span>
      <span className="min-w-0">
        <span className="block font-semibold text-slate-800 truncate group-hover:text-primary">{name}</span>
        {code && <span className="block text-[11px] text-slate-400 truncate">{code}</span>}
      </span>
    </>
  );
  return id
    ? <Link to={`/hr/employees/${id}`} className="group flex items-center gap-2.5">{body}</Link>
    : <div className="flex items-center gap-2.5">{body}</div>;
}

/** Inline pay-basis switch shown in the employee Type column — one tap flips Hourly ↔ Monthly. */
function BasisToggle({ model, onToggle }: { model?: string; onToggle: () => void }) {
  if (model === "CONTRACT") return <PayTypeTag model={model} />;
  const hourly = model === "HOURLY";
  return (
    <button
      type="button" onClick={onToggle}
      title={`Switch to ${hourly ? "Monthly" : "Hourly"} basis`}
      className={`group inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
        hourly ? "bg-cyan-100 text-cyan-700 hover:bg-cyan-200" : "bg-violet-100 text-violet-700 hover:bg-violet-200"
      }`}
    >
      {hourly ? "Hourly" : "Monthly"}
      <ArrowLeftRight className="w-3 h-3 opacity-50 group-hover:opacity-100" />
    </button>
  );
}

function PayTypeTag({ model }: { model?: string }) {
  const tone: Record<string, string> = {
    HOURLY: "bg-cyan-100 text-cyan-700",
    MONTHLY: "bg-violet-100 text-violet-700",
    CONTRACT: "bg-amber-100 text-amber-700",
  };
  const label = model === "HOURLY" ? "Hourly" : model === "CONTRACT" ? "Contract" : "Monthly";
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tone[model || "MONTHLY"] || "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

/** Person cell — routes to the employee record or the contractor detail page, colour-coded by type. */
function PersonCell({ line }: { line: PayrollLine }) {
  const isCon = line.resourceType === "CONTRACTOR";
  const to = line.personId
    ? (isCon ? `/contractors/directory/${line.personId}` : `/hr/employees/${line.personId}`)
    : undefined;
  const initials = (line.name || "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const avatar = isCon ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  const body = (
    <>
      <span className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-[11px] font-bold ${avatar}`}>{initials}</span>
      <span className="min-w-0">
        <span className="block font-semibold text-slate-800 truncate group-hover:text-primary">{line.name}</span>
        {line.code && <span className="block text-[11px] text-slate-400 truncate">{line.code}</span>}
      </span>
    </>
  );
  return to
    ? <Link to={to} className="group flex items-center gap-2.5">{body}</Link>
    : <div className="flex items-center gap-2.5">{body}</div>;
}

/** Per-row action — inline Approve/Pay for employees; a deep-link for contractors (never inline pay). */
function RowAction({ line, onApprove, onPay, canProcess }: { line: PayrollLine; onApprove: (id: number) => void; onPay: (id: number) => void; canProcess: boolean }) {
  if (line.resourceType === "CONTRACTOR") {
    const to = line.actionHint === "LEDGER" ? "/contractors/ledger" : `/contractors/directory/${line.personId}`;
    const label = line.actionHint === "LEDGER" ? "Ledger" : "Open bill";
    return (
      <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
        <ExternalLink className="w-3.5 h-3.5" /> {label}
      </Link>
    );
  }
  const id = line.recordId ?? undefined;
  return (
    <div className="inline-flex items-center gap-1.5">
      {canProcess && line.status === "PENDING" && id && <Button size="sm" variant="outline" onClick={() => onApprove(id)}><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>}
      {canProcess && line.status === "APPROVED" && id && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onPay(id)}><BadgeIndianRupee className="w-3.5 h-3.5 mr-1" /> Pay</Button>}
      {id && <Button size="sm" variant="ghost" title="Open payslip" onClick={() => window.open(`/hr/payslip/${id}`, "_blank")}><FileText className="w-4 h-4" /></Button>}
    </div>
  );
}

/** Mobile card for an employee salary line. */
function EmpCard({ l, canProcess, onToggle, onApprove, onPay }: { l: PayrollLine; canProcess: boolean; onToggle: () => void; onApprove: (id: number) => void; onPay: (id: number) => void }) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <PersonCell line={l} />
        <StatusBadge status={l.status} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {canProcess ? <BasisToggle model={l.payModel} onToggle={onToggle} /> : <PayTypeTag model={l.payModel} />}
        <span className="text-xs text-slate-500">{l.basisLabel || "—"}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
        <div><div className="text-slate-400">Gross</div><div className="font-semibold text-slate-700">{l.gross != null ? inr(l.gross) : "—"}</div></div>
        <div><div className="text-slate-400">Deductions</div><div className="font-semibold text-rose-600">{num(l.deductions) > 0 ? inr(l.deductions) : "—"}</div></div>
        <div><div className="text-slate-400">Net</div><div className="font-bold text-emerald-600">{inr(l.payable)}</div></div>
      </div>
      <div className="mt-2 flex justify-end"><RowAction line={l} onApprove={onApprove} onPay={onPay} canProcess={canProcess} /></div>
    </div>
  );
}

/** Mobile card for a contractor payment line. */
function ConCard({ l }: { l: PayrollLine }) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <PersonCell line={l} />
        <StatusBadge status={l.status} />
      </div>
      <div className="mt-1 text-xs text-slate-500">{l.basisLabel || "—"}</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
        <div><div className="text-slate-400">Billed</div><div className="font-semibold text-slate-700">{inr(l.billedTotal)}</div></div>
        <div><div className="text-slate-400">Paid</div><div className="font-semibold text-emerald-600">{inr(l.paidToDate)}</div></div>
        <div><div className="text-slate-400">Pending</div><div className="font-bold text-amber-700">{num(l.outstanding) > 0 ? inr(l.outstanding) : "—"}</div></div>
      </div>
      <div className="mt-2 flex justify-end"><RowAction line={l} onApprove={() => {}} onPay={() => {}} canProcess={false} /></div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_TONE[status || ""] || "bg-slate-100 text-slate-600"}`}>{status || "—"}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "amber" | "rose" }) {
  const bg = tone === "amber" ? "bg-amber-50 border-amber-200" : tone === "rose" ? "bg-rose-50 border-rose-200" : "bg-white";
  return (
    <div className={`rounded-xl border p-3.5 shadow-sm ${bg}`}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}
