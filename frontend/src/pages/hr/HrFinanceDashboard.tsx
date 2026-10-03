import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { payrollApi } from "@/api/payrollApi";
import type { FinanceDashboard, EmployeeDeduction, PayrollLine, PayrollSummary, PayrollRequest } from "@/types/payroll";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import { useAuth } from "@/hooks/useAuth";
import QuickPayDialog from "./QuickPayDialog";
import PayslipEditor from "./PayslipEditor";
import GeneratePayslips from "./GeneratePayslips";
import WageSettingsDialog from "@/components/hr/WageSettingsDialog";
import api from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/ui/searchable-select";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, PlayCircle, Gift, Plus, Check, BadgeIndianRupee, Settings2, MinusCircle, FileText,
  Wallet, CircleHelp, ExternalLink, Zap, Pencil, MoreHorizontal, Inbox, X,
} from "lucide-react";
import {
  CardStat, FilterChips, MONTHS, PeriodPicker, PersonChip, SearchField, StatTile, StatusPill,
} from "@/pages/workforce/hrUi";

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
const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;

/** Payslip statuses read as the next step for the person running payroll. */
const SLIP_LABELS = { PENDING: "To approve", APPROVED: "To pay", PAID: "Paid" };

type EmpStatus = "ALL" | "PENDING" | "APPROVED" | "PAID";

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
  const [tab, setTab] = useState("salary");
  const [previewKey, setPreviewKey] = useState(0);
  const [editSlip, setEditSlip] = useState<{ employeeId: number; name?: string } | null>(null);

  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [psum, setPsum] = useState<PayrollSummary | null>(null);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<EmployeeDeduction[]>([]);
  const [payReqs, setPayReqs] = useState<PayrollRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // table search / filters
  const [empSearch, setEmpSearch] = useState("");
  const [empStatus, setEmpStatus] = useState<EmpStatus>("ALL");
  const [conSearch, setConSearch] = useState("");

  const [awardOpen, setAwardOpen] = useState(false);
  const [award, setAward] = useState({ employeeId: "", bonusType: "PROJECT_COMPLETION", amount: "", projectId: "", reason: "" });
  const [dedOpen, setDedOpen] = useState(false);
  const [ded, setDed] = useState({ employeeId: "", deductionType: "FINE", amount: "", reason: "" });
  const [wageOpen, setWageOpen] = useState(false);
  const [wageEmpId, setWageEmpId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<{ id: number; remarks: string } | null>(null);

  const load = () => {
    setLoading(true);
    payrollApi.financeDashboard().then(setD).catch(console.error).finally(() => setLoading(false));
  };
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
  useEffect(() => { loadUnified(); }, [month, year]);

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
  const employeeOptions = useMemo(
    () => employees.map((e: any) => ({ value: String(e.id), label: empName(e), hint: e.employeeCode || undefined })),
    [employees],
  );
  const projectOptions = useMemo(
    () => projects.map((p: any) => ({ value: String(p.id), label: p.projectName || p.name || `Project #${p.id}` })),
    [projects],
  );

  const runAlerts = () => {
    payrollApi.runAlerts()
      .then((r: any) => toast.success(`Alerts sent — ${r.overduePayments} overdue, ${r.finalPaymentsPending} final pending, ${r.contractsClosedWithBalance} closed w/ balance.`))
      .catch(() => toast.error("Failed to send alerts"));
  };
  const approveRec = (id: number) => payrollApi.approvePayroll(id).then(() => { toast.success("Payslip approved."); loadUnified(); }).catch((e) => toast.error(errMsg(e, "Failed")));
  const payRec = (id: number) => payrollApi.markPaid(id).then(() => { toast.success("Marked as paid."); loadUnified(); load(); }).catch((e) => toast.error(errMsg(e, "Failed")));
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
      .catch((e) => toast.error(errMsg(e, "Failed to award bonus")));
  };

  const submitDeduction = () => {
    if (!ded.employeeId) { toast.error("Select an employee for the deduction."); return; }
    if (!ded.amount || Number(ded.amount) <= 0) { toast.error("Enter a deduction amount greater than zero."); return; }
    payrollApi.createDeduction(Number(ded.employeeId), {
      deductionType: ded.deductionType, amount: Number(ded.amount), reason: ded.reason || undefined,
    })
      .then(() => { setDedOpen(false); setDed({ employeeId: "", deductionType: "FINE", amount: "", reason: "" }); toast.success("Deduction added."); loadDeductions(); })
      .catch((e) => toast.error(errMsg(e, "Failed to add deduction")));
  };

  const approveBonus = (id: number) => payrollApi.approveBonus(id).then(() => { toast.success("Bonus approved."); loadBonuses(); }).catch((e) => toast.error(errMsg(e, "Failed")));
  const payBonus = (id: number) => payrollApi.payBonus(id).then(() => { toast.success("Bonus marked paid."); loadBonuses(); }).catch((e) => toast.error(errMsg(e, "Failed")));
  const approveDeduction = (id: number) => payrollApi.approveDeduction(id).then(() => { toast.success("Deduction approved."); loadDeductions(); }).catch((e) => toast.error(errMsg(e, "Failed")));
  const approveRequest = (id: number) => payrollApi.approvePayrollRequest(id)
    .then(() => { toast.success("Request approved."); loadPayReqs(); load(); })
    .catch((e) => toast.error(errMsg(e, "Failed to approve")));
  const rejectRequest = () => {
    if (!rejecting) return;
    payrollApi.rejectPayrollRequest(rejecting.id, rejecting.remarks.trim() || undefined)
      .then(() => { toast.success("Request rejected."); setRejecting(null); loadPayReqs(); })
      .catch((e) => toast.error(errMsg(e, "Failed to reject")));
  };

  const openWage = (employeeId?: number | null) => { setWageEmpId(employeeId ?? null); setWageOpen(true); };
  const showSlips = (status: EmpStatus) => { setEmpStatus(status); setTab("salary"); };
  const onEditSlip = (ln: PayrollLine) => setEditSlip({ employeeId: ln.personId!, name: ln.name });

  if (loading || !d) return <div className="p-6 text-muted-foreground">Loading payroll…</div>;

  const select = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const toApprove = psum?.toApprove ?? 0;
  const toPay = psum?.toPay ?? 0;

  // ---------- list definitions ----------
  const salaryCols: Column<PayrollLine>[] = [
    { key: "who", header: "Employee", cell: (l) => <PersonCell line={l} /> },
    { key: "type", header: "Pay basis", headClassName: "hidden xl:table-cell", cellClassName: "hidden xl:table-cell", cell: (l) => (
      <div><PayTypeTag model={l.payModel} /><div className="mt-0.5 whitespace-nowrap text-xs text-slate-500">{l.basisLabel || "—"}</div></div>
    ) },
    { key: "gross", header: "Gross", headClassName: "hidden text-right xl:table-cell", cellClassName: "hidden text-right tabular-nums text-slate-700 xl:table-cell", cell: (l) => l.gross != null ? inr(l.gross) : "—" },
    { key: "ded", header: "Deductions", headClassName: "hidden text-right xl:table-cell", cellClassName: "hidden text-right tabular-nums text-rose-700 xl:table-cell", cell: (l) => num(l.deductions) > 0 ? `− ${inr(l.deductions)}` : <span className="text-slate-400">—</span> },
    { key: "net", header: "Net payable", headClassName: "text-right", cellClassName: "text-right tabular-nums", cell: (l) => (
      <div>
        <div className="font-semibold text-slate-900">{inr(l.payable)}</div>
        {/* Gross / deductions have their own columns on wide screens */}
        <div className="whitespace-nowrap text-xs text-slate-500 xl:hidden">
          {l.gross != null ? inr(l.gross) : "—"}{num(l.deductions) > 0 && <span className="text-rose-700"> − {inr(l.deductions)}</span>}
        </div>
      </div>
    ) },
    { key: "status", header: "Status", cell: (l) => (
      <div className="flex flex-col items-start gap-1">
        <StatusPill status={l.status} labels={SLIP_LABELS} />
        <span className="xl:hidden"><PayTypeTag model={l.payModel} /></span>
      </div>
    ) },
    { key: "act", header: <span className="sr-only">Actions</span>, headClassName: "text-right", cellClassName: "text-right whitespace-nowrap",
      cell: (l) => <RowAction line={l} onApprove={approveRec} onPay={payRec} canProcess={canProcess} onEdit={onEditSlip} onWage={openWage} /> },
  ];

  const conCols: Column<PayrollLine>[] = [
    { key: "who", header: "Contractor", cell: (l) => <PersonCell line={l} /> },
    { key: "period", header: "This period", headClassName: "hidden xl:table-cell", cellClassName: "hidden whitespace-nowrap text-slate-500 xl:table-cell", cell: (l) => l.basisLabel || "—" },
    { key: "billed", header: "Total billed", headClassName: "text-right", cellClassName: "text-right tabular-nums text-slate-700", cell: (l) => inr(l.billedTotal) },
    { key: "paid", header: "Paid so far", headClassName: "text-right", cellClassName: "text-right tabular-nums text-slate-700", cell: (l) => inr(l.paidToDate) },
    { key: "pending", header: "Pending", headClassName: "text-right", cellClassName: "text-right tabular-nums font-semibold text-amber-800", cell: (l) => num(l.outstanding) > 0 ? inr(l.outstanding) : <span className="font-normal text-slate-400">—</span> },
    { key: "status", header: "Status", cell: (l) => <StatusPill status={l.status} /> },
    { key: "act", header: <span className="sr-only">Actions</span>, headClassName: "text-right", cellClassName: "text-right whitespace-nowrap",
      cell: (l) => <RowAction line={l} onApprove={approveRec} onPay={payRec} canProcess={canProcess} /> },
  ];

  const bonusCols: Column<any>[] = [
    { key: "who", header: "Employee", cell: (b) => <EmpLink emp={b.employee} /> },
    { key: "why", header: "Reason", cell: (b) => <Reason kind={BONUS_LABEL[b.bonusType] || b.bonusType} text={b.project?.projectName || b.reason} /> },
    { key: "amt", header: "Amount", headClassName: "text-right", cellClassName: "text-right tabular-nums font-semibold text-slate-900", cell: (b) => inr(b.amount) },
    { key: "status", header: "Status", cell: (b) => <StatusPill status={b.status} /> },
    { key: "act", header: <span className="sr-only">Actions</span>, headClassName: "text-right", cellClassName: "text-right whitespace-nowrap", cell: (b) => bonusActions(b) },
  ];

  const dedCols: Column<any>[] = [
    { key: "who", header: "Employee", cell: (b) => <EmpLink emp={b.employee} /> },
    { key: "why", header: "Reason", cell: (b) => <Reason kind={DEDUCTION_LABEL[b.deductionType] || b.deductionType} text={b.reason} /> },
    { key: "amt", header: "Amount", headClassName: "text-right", cellClassName: "text-right tabular-nums font-semibold text-rose-700", cell: (b) => inr(b.amount) },
    { key: "status", header: "Status", cell: (b) => <StatusPill status={b.status} /> },
    { key: "act", header: <span className="sr-only">Actions</span>, headClassName: "text-right", cellClassName: "text-right whitespace-nowrap", cell: (b) => deductionActions(b) },
  ];

  const isCredit = (r: PayrollRequest) => r.requestType === "OTHER" && r.direction === "CREDIT";
  const reqCols: Column<PayrollRequest>[] = [
    { key: "who", header: "Employee", cell: (r) => <EmpLink emp={r.employee} /> },
    { key: "what", header: "Request", cell: (r) => <Reason kind={`${REQUEST_LABEL[r.requestType] || r.requestType}${isCredit(r) ? " · reimbursement" : ""}`} text={r.reason} /> },
    { key: "for", header: "For", headClassName: "hidden xl:table-cell", cellClassName: "hidden whitespace-nowrap text-slate-600 xl:table-cell", cell: (r) => r.targetMonth ? `${MONTHS_SHORT[r.targetMonth]} ${r.targetYear}` : "—" },
    { key: "amt", header: "Amount", headClassName: "text-right", cellClassName: "text-right tabular-nums font-semibold", cell: (r) => <span className={isCredit(r) ? "text-emerald-700" : "text-rose-700"}>{inr(r.amount)}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusPill status={r.status} /> },
    { key: "act", header: <span className="sr-only">Actions</span>, headClassName: "text-right", cellClassName: "text-right whitespace-nowrap", cell: (r) => requestActions(r) },
  ];

  function bonusActions(b: any) {
    if (!canProcess) return null;
    return (
      <div className="inline-flex gap-1.5">
        {(b.status === "PENDING" || b.status === "RECOMMENDED") && <Button size="sm" variant="outline" onClick={() => approveBonus(b.id)}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>}
        {b.status !== "PAID" && <Button size="sm" variant="forest" onClick={() => payBonus(b.id)}><BadgeIndianRupee className="mr-1 h-3.5 w-3.5" /> Mark paid</Button>}
      </div>
    );
  }
  function deductionActions(b: any) {
    if (!canProcess || b.status !== "PENDING") return null;
    return <Button size="sm" variant="outline" onClick={() => approveDeduction(b.id)}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>;
  }
  function requestActions(r: PayrollRequest) {
    if (!canProcess || r.status !== "PENDING") return null;
    return (
      <div className="inline-flex gap-1.5">
        <Button size="sm" variant="forest" onClick={() => approveRequest(r.id)}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>
        <Button size="sm" variant="outline" onClick={() => setRejecting({ id: r.id, remarks: "" })}><X className="mr-1 h-3.5 w-3.5" /> Reject</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ---- PERIOD BAR — which month, where the run stands, and the actions to move it on.
              Sticky on wide screens so it stays in reach; scrolls away on smaller screens to save height. ---- */}
      <div className="z-20 bg-slate-50 xl:sticky xl:top-0 xl:pb-1">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="text-xs font-medium text-slate-500">Payroll period</div>
              <PeriodPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
            </div>
            {canProcess ? (
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Button onClick={() => setTab("generate")} className="flex-1 sm:flex-none">
                  <PlayCircle className="mr-1.5 h-4 w-4" /> Generate payslips
                </Button>
                <Button variant="forest" onClick={() => setQuickOpen(true)} className="flex-1 sm:flex-none">
                  <Zap className="mr-1.5 h-4 w-4" /> Quick pay
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0" aria-label="More payroll actions"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => openWage()}><Settings2 className="mr-2 h-4 w-4" /> Wage &amp; pay basis</DropdownMenuItem>
                    <DropdownMenuItem onClick={runAlerts}><Bell className="mr-2 h-4 w-4" /> Send payment alerts</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">View only</span>
            )}
          </div>

          {/* Run progress — the next steps, each one opens the matching payslips */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <RunStep label="To approve" value={toApprove} tone={toApprove > 0 ? "warning" : "muted"} onClick={() => showSlips("PENDING")} />
            <RunStep label="To pay" value={toPay} tone={toPay > 0 ? "primary" : "muted"} onClick={() => showSlips("APPROVED")} />
            <RunStep label="Total payout" value={inr(psum?.combinedPayout)} tone="muted" onClick={() => showSlips("ALL")} />
          </div>
          <p className="mt-3 hidden items-start gap-1.5 border-t pt-3 text-xs text-slate-500 lg:flex">
            <CircleHelp className="mt-px h-3.5 w-3.5 shrink-0" />
            {canProcess
              ? `Payslips are built from attendance hours. "Generate payslips" prices each employee's hours Hourly and Monthly — pick one per person. Generating again only fills anyone missed; nobody is paid twice.`
              : `You can review payroll for ${MONTHS[month - 1]} ${year}. Approving and paying require payroll-processing rights.`}
          </p>
        </div>
      </div>

      {/* ---- MONEY AT A GLANCE — employee money, then contractor money ---- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Payroll due" value={inr(d.employee.payrollDue)} tone={num(d.employee.payrollDue) > 0 ? "warning" : "neutral"} />
        <StatTile label="Paid this month" value={inr(d.employee.salaryPaidThisMonth)} tone="success" />
        <StatTile label="Advances out" value={inr(d.employee.advancesOutstanding)} hint="to recover" />
        <StatTile label="Loans out" value={inr(d.employee.loansOutstanding)} hint="to recover" />
        <StatTile label="Contractor pending" value={inr(d.contractor.outstandingPayments)} tone={num(d.contractor.outstandingPayments) > 0 ? "warning" : "neutral"} />
        <StatTile label="Contractor overdue" value={inr(d.contractor.overduePayments)} tone={num(d.contractor.overduePayments) > 0 ? "danger" : "neutral"} />
      </div>

      {/* ---- TABS — one focused section at a time ---- */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="h-auto w-max">
            <TabsTrigger value="salary" className="py-1.5">Salary <CountPill n={empLines.length} /></TabsTrigger>
            <TabsTrigger value="contractors" className="py-1.5">Contractors <CountPill n={conLines.length} /></TabsTrigger>
            <TabsTrigger value="adjustments" className="py-1.5">Bonuses &amp; deductions</TabsTrigger>
            <TabsTrigger value="requests" className="py-1.5">Requests {pendingReqCount > 0 && <CountPill n={pendingReqCount} tone="amber" />}</TabsTrigger>
            <TabsTrigger value="generate" className="py-1.5">Generate</TabsTrigger>
          </TabsList>
        </div>

        {/* ===================== SALARY ===================== */}
        <TabsContent value="salary" className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <FilterChips<EmpStatus>
              value={empStatus} onChange={setEmpStatus}
              options={[
                { key: "ALL", label: "All", count: empStatusCounts.ALL },
                { key: "PENDING", label: "To approve", count: empStatusCounts.PENDING },
                { key: "APPROVED", label: "To pay", count: empStatusCounts.APPROVED },
                { key: "PAID", label: "Paid", count: empStatusCounts.PAID },
              ]}
            />
            <SearchField value={empSearch} onChange={setEmpSearch} placeholder="Search employee or code…" className="md:w-72" />
          </div>

          <ResponsiveList
            items={filteredEmp}
            columns={salaryCols}
            getRowKey={(l) => `emp-${l.personId}-${l.recordId ?? ""}`}
            emptyIcon={BadgeIndianRupee}
            emptyTitle={empLines.length ? "No employees match" : `No payslips for ${MONTHS[month - 1]} yet`}
            emptyDescription={empLines.length ? "Change the search or status filter." : "Generate payslips to build them from attendance hours."}
            emptyAction={!empLines.length && canProcess
              ? <Button size="sm" onClick={() => setTab("generate")}><PlayCircle className="mr-1 h-4 w-4" /> Generate payslips</Button>
              : undefined}
            renderCard={(l) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell line={l} />
                  <StatusPill status={l.status} labels={SLIP_LABELS} />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <PayTypeTag model={l.payModel} /> <span className="truncate">{l.basisLabel || "—"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5">
                  <CardStat label="Gross" value={l.gross != null ? inr(l.gross) : "—"} />
                  <CardStat label="Deductions" value={num(l.deductions) > 0 ? inr(l.deductions) : "—"} className="text-rose-700" />
                  <CardStat label="Net" value={inr(l.payable)} className="font-semibold" />
                </div>
                <div className="flex justify-end">
                  <RowAction line={l} onApprove={approveRec} onPay={payRec} canProcess={canProcess} onEdit={onEditSlip} onWage={openWage} />
                </div>
              </div>
            )}
          />
          {filteredEmp.length > 0 && (
            <p className="text-xs text-slate-500">Showing {filteredEmp.length} of {empLines.length} · {MONTHS[month - 1]} {year}</p>
          )}
        </TabsContent>

        {/* ===================== CONTRACTORS ===================== */}
        <TabsContent value="contractors" className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {filteredCon.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 md:flex md:gap-6">
                <CardStat label="Billed" value={inr(conTotals.billed)} />
                <CardStat label="Paid so far" value={inr(conTotals.paid)} />
                <CardStat label="Pending" value={inr(conTotals.pending)} className="font-semibold text-amber-800" />
              </div>
            ) : <span />}
            <SearchField value={conSearch} onChange={setConSearch} placeholder="Search contractor or code…" className="md:w-72" />
          </div>

          <ResponsiveList
            items={filteredCon}
            columns={conCols}
            getRowKey={(l) => `con-${l.personId}-${l.recordId ?? ""}`}
            emptyIcon={Wallet}
            emptyTitle="No contractor balances"
            emptyDescription="A contractor appears here once they carry an open bill balance."
            renderCard={(l) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell line={l} />
                  <StatusPill status={l.status} />
                </div>
                {l.basisLabel && <div className="text-xs text-slate-500">{l.basisLabel}</div>}
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5">
                  <CardStat label="Billed" value={inr(l.billedTotal)} />
                  <CardStat label="Paid" value={inr(l.paidToDate)} />
                  <CardStat label="Pending" value={num(l.outstanding) > 0 ? inr(l.outstanding) : "—"} className="font-semibold text-amber-800" />
                </div>
                <div className="flex justify-end"><RowAction line={l} onApprove={() => {}} onPay={() => {}} canProcess={false} /></div>
              </div>
            )}
          />
          <p className="text-xs text-slate-500">
            <b>Paid so far</b> includes advances; <b>Pending</b> is the open balance across all their bills. Contractors are paid from their bill or ledger, not here.
          </p>
        </TabsContent>

        {/* ===================== BONUSES & DEDUCTIONS ===================== */}
        <TabsContent value="adjustments" className="mt-4">
          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <div className="space-y-3">
              <ListHeader icon={Gift} title="Bonuses" count={bonuses.length}
                action={canProcess && <Button size="sm" onClick={() => setAwardOpen(true)}><Plus className="mr-1 h-4 w-4" /> Award bonus</Button>} />
              <ResponsiveList
                items={bonuses} columns={bonusCols} getRowKey={(b) => b.id}
                emptyIcon={Gift} emptyTitle="No bonuses awarded yet"
                renderCard={(b) => (
                  <AdjustmentCard emp={b.employee} kind={BONUS_LABEL[b.bonusType] || b.bonusType} text={b.project?.projectName || b.reason}
                    amount={inr(b.amount)} status={b.status} actions={bonusActions(b)} />
                )}
              />
            </div>
            <div className="space-y-3">
              <ListHeader icon={MinusCircle} title="Deductions" count={deductions.length}
                action={canProcess && <Button size="sm" variant="outline" onClick={() => setDedOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add deduction</Button>} />
              <ResponsiveList
                items={deductions} columns={dedCols} getRowKey={(b: any) => b.id}
                emptyIcon={MinusCircle} emptyTitle="No manual deductions"
                renderCard={(b: any) => (
                  <AdjustmentCard emp={b.employee} kind={DEDUCTION_LABEL[b.deductionType] || b.deductionType} text={b.reason}
                    amount={inr(b.amount)} amountClass="text-rose-700" status={b.status} actions={deductionActions(b)} />
                )}
              />
            </div>
          </div>
        </TabsContent>

        {/* ===================== REQUESTS ===================== */}
        <TabsContent value="requests" className="mt-4 space-y-3">
          <ListHeader icon={Inbox} title="Employee requests" count={payReqs.length}
            badge={pendingReqCount > 0 ? `${pendingReqCount} waiting` : undefined} />
          <ResponsiveList
            items={payReqs} columns={reqCols} getRowKey={(r) => r.id}
            emptyIcon={Inbox} emptyTitle="No employee requests"
            emptyDescription="Advances and repayment requests from the employee app show up here."
            renderCard={(r) => (
              <AdjustmentCard emp={r.employee}
                kind={`${REQUEST_LABEL[r.requestType] || r.requestType}${isCredit(r) ? " · reimbursement" : ""}${r.targetMonth ? ` · ${MONTHS_SHORT[r.targetMonth]} ${r.targetYear}` : ""}`}
                text={r.reason} amount={inr(r.amount)} amountClass={isCredit(r) ? "text-emerald-700" : "text-rose-700"}
                status={r.status} actions={requestActions(r)} />
            )}
          />
          <p className="text-xs text-slate-500">
            Approving an advance creates a recoverable advance; loan repayments and other adjustments are applied to the target month's payroll run.
          </p>
        </TabsContent>

        {/* ===================== GENERATE ===================== */}
        <TabsContent value="generate" className="mt-4">
          <GeneratePayslips
            key={`${month}-${year}-${previewKey}`}
            month={month} year={year} canProcess={canProcess}
            onGenerated={() => { loadUnified(); load(); loadBonuses(); loadDeductions(); loadPayReqs(); }}
            onEditWage={canProcess ? openWage : undefined}
          />
        </TabsContent>
      </Tabs>

      {/* AWARD BONUS */}
      <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Award bonus</DialogTitle>
            <DialogDescription>Paid with the employee's next payslip once approved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <SearchableSelect value={award.employeeId} onChange={(v) => setAward({ ...award, employeeId: v })} options={employeeOptions} placeholder="Select employee…" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Bonus type</Label>
                <select className={select} value={award.bonusType} onChange={(e) => setAward({ ...award, bonusType: e.target.value })}>
                  {BONUS_TYPES.map((t) => <option key={t} value={t}>{BONUS_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" inputMode="decimal" value={award.amount} onChange={(e) => setAward({ ...award, amount: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Project <span className="font-normal text-slate-400">(optional)</span></Label>
              <SearchableSelect value={award.projectId} onChange={(v) => setAward({ ...award, projectId: v })} options={projectOptions} placeholder="No project" clearLabel="No project" />
            </div>
            <div className="space-y-1.5"><Label>Reason / note</Label><Input value={award.reason} onChange={(e) => setAward({ ...award, reason: e.target.value })} placeholder="e.g. On-time completion of Villa project" /></div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setAwardOpen(false)}>Cancel</Button>
              <Button onClick={submitAward}>Award bonus</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD DEDUCTION */}
      <Dialog open={dedOpen} onOpenChange={setDedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add deduction</DialogTitle>
            <DialogDescription>Taken off the employee's next payslip once approved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <SearchableSelect value={ded.employeeId} onChange={(v) => setDed({ ...ded, employeeId: v })} options={employeeOptions} placeholder="Select employee…" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select className={select} value={ded.deductionType} onChange={(e) => setDed({ ...ded, deductionType: e.target.value })}>
                  {DEDUCTION_TYPES.map((t) => <option key={t} value={t}>{DEDUCTION_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" inputMode="decimal" value={ded.amount} onChange={(e) => setDed({ ...ded, amount: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Reason</Label><Input value={ded.reason} onChange={(e) => setDed({ ...ded, reason: e.target.value })} placeholder="e.g. Damaged equipment" /></div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setDedOpen(false)}>Cancel</Button>
              <Button onClick={submitDeduction}>Add deduction</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* REJECT REQUEST */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>The employee sees this reason in their app.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Reason <span className="font-normal text-slate-400">(optional)</span></Label>
              <Input autoFocus value={rejecting?.remarks ?? ""} onChange={(e) => setRejecting((r) => r && { ...r, remarks: e.target.value })} placeholder="e.g. Already recovered last month" />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button variant="destructive" onClick={rejectRequest}>Reject request</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WAGE & PAY BASIS */}
      <WageSettingsDialog
        open={wageOpen}
        onClose={() => setWageOpen(false)}
        employeeId={wageEmpId}
        employees={employees}
        month={month}
        year={year}
        onSaved={() => { reloadEmployees(); loadUnified(); setPreviewKey((k) => k + 1); }}
      />

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

      {editSlip && (
        <PayslipEditor
          employeeId={editSlip.employeeId}
          name={editSlip.name}
          month={month}
          year={year}
          onClose={() => setEditSlip(null)}
          onChanged={() => loadUnified()}
        />
      )}
    </div>
  );
}

function RunStep({ label, value, tone, onClick }: { label: string; value: React.ReactNode; tone: "warning" | "primary" | "muted"; onClick: () => void }) {
  const t = tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800"
    : tone === "primary" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-slate-200 bg-card text-slate-700";
  return (
    <button type="button" onClick={onClick}
      className={`min-w-0 rounded-lg border px-3 py-2 text-left transition-colors hover:border-slate-300 ${t}`}>
      <div className="truncate text-[11px] font-medium opacity-80">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
    </button>
  );
}

function CountPill({ n, tone }: { n: number; tone?: "amber" }) {
  return (
    <span className={`ml-1.5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-slate-200/70 text-slate-600"}`}>{n}</span>
  );
}

function ListHeader({ icon: Icon, title, count, action, badge }: { icon: typeof Gift; title: string; count?: number; action?: React.ReactNode; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-slate-500" /> {title}
        {count != null && <span className="text-sm font-normal text-slate-500">{count}</span>}
        {badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{badge}</span>}
      </h3>
      {action}
    </div>
  );
}

/** Clickable employee cell — opens the employee's full HR record. */
function EmpLink({ emp }: { emp?: any }) {
  if (!emp) return <span className="text-slate-400">—</span>;
  return <PersonChip name={empName(emp)} sub={emp.employeeCode} to={emp.id ? `/hr/employees/${emp.id}` : undefined} size="sm" />;
}

function Reason({ kind, text }: { kind: string; text?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-500">{kind}</div>
      <div className="max-w-[18rem] truncate text-slate-700">{text || "—"}</div>
    </div>
  );
}

/** Phone card shared by bonuses, deductions and requests. */
function AdjustmentCard({ emp, kind, text, amount, amountClass = "text-slate-900", status, actions }: {
  emp?: any; kind: string; text?: string | null; amount: string; amountClass?: string; status?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <EmpLink emp={emp} />
        <div className="text-right">
          <div className={`font-semibold tabular-nums ${amountClass}`}>{amount}</div>
          <StatusPill status={status} />
        </div>
      </div>
      <div className="text-sm">
        <span className="text-xs font-medium text-slate-500">{kind}</span>
        {text && <p className="text-slate-700">{text}</p>}
      </div>
      {actions && <div className="flex justify-end">{actions}</div>}
    </div>
  );
}

function PayTypeTag({ model }: { model?: string }) {
  const tone: Record<string, string> = {
    HOURLY: "bg-sky-100 text-sky-800",
    MONTHLY: "bg-violet-100 text-violet-800",
    CONTRACT: "bg-amber-100 text-amber-800",
  };
  const label = model === "HOURLY" ? "Hourly" : model === "CONTRACT" ? "Contract" : "Monthly";
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone[model || "MONTHLY"] || "bg-slate-100 text-slate-600"}`}>
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
  return <PersonChip name={line.name} sub={line.code} to={to} tone={isCon ? "contractor" : "employee"} />;
}

/** Per-row action — the one next step as a button (Approve / Pay), the rest tucked into a menu. */
function RowAction({ line, onApprove, onPay, canProcess, onEdit, onWage }: { line: PayrollLine; onApprove: (id: number) => void; onPay: (id: number) => void; canProcess: boolean; onEdit?: (line: PayrollLine) => void; onWage?: (employeeId: number) => void }) {
  if (line.resourceType === "CONTRACTOR") {
    const to = line.actionHint === "LEDGER" ? "/contractors/ledger" : `/contractors/directory/${line.personId}`;
    const label = line.actionHint === "LEDGER" ? "Ledger" : "Open bill";
    return (
      <Button asChild size="sm" variant="outline">
        <Link to={to}><ExternalLink className="mr-1 h-3.5 w-3.5" /> {label}</Link>
      </Button>
    );
  }
  const id = line.recordId ?? undefined;
  const canEdit = canProcess && onEdit && id && line.status !== "PAID" && line.personId;
  const canWage = canProcess && onWage && line.personId;
  return (
    <div className="inline-flex items-center gap-1.5">
      {canProcess && line.status === "PENDING" && id && <Button size="sm" variant="outline" onClick={() => onApprove(id)}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>}
      {canProcess && line.status === "APPROVED" && id && <Button size="sm" variant="forest" onClick={() => onPay(id)}><BadgeIndianRupee className="mr-1 h-3.5 w-3.5" /> Pay</Button>}
      {id && (
        <Button size="sm" variant="ghost" className="h-9 w-9 p-0" title="Open payslip" aria-label="Open payslip" onClick={() => window.open(`/hr/payslip/${id}`, "_blank")}>
          <FileText className="h-4 w-4" />
        </Button>
      )}
      {(canEdit || canWage) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-9 w-9 p-0" aria-label={`More actions for ${line.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {canEdit && <DropdownMenuItem onClick={() => onEdit!(line)}><Pencil className="mr-2 h-4 w-4" /> Edit payslip lines</DropdownMenuItem>}
            {canWage && <DropdownMenuItem onClick={() => onWage!(line.personId!)}><Settings2 className="mr-2 h-4 w-4" /> Wage &amp; pay basis</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
