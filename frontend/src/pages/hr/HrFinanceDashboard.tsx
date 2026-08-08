import { useEffect, useState } from "react";
import { payrollApi } from "@/api/payrollApi";
import type { FinanceDashboard, SalaryRecord, EmployeeDeduction, WageSettings } from "@/types/payroll";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Users, HardHat, Bell, PlayCircle, Clock, Gift, Plus, Check, BadgeIndianRupee,
  Settings2, MinusCircle, FileText, Wallet,
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

const empName = (e: any) => (e ? [e.firstName, e.lastName].filter(Boolean).join(" ") : "—");
const num = (v: any) => Number(v || 0);

export default function HrFinanceDashboard() {
  const [d, setD] = useState<FinanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [msg, setMsg] = useState<string | null>(null);

  const [hourly, setHourly] = useState<any | null>(null);
  const [register, setRegister] = useState<SalaryRecord[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<EmployeeDeduction[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

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
  const loadRegister = () => payrollApi.register(month, year).then(setRegister).catch(() => setRegister([]));
  const loadBonuses = () => payrollApi.allBonuses().then(setBonuses).catch(() => setBonuses([]));
  const loadDeductions = () => payrollApi.allDeductions().then(setDeductions).catch(() => setDeductions([]));

  useEffect(() => { load(); loadBonuses(); loadDeductions();
    api.get(`/hr/employees?size=500`).then(r => setEmployees(r.data.content || [])).catch(() => {});
    api.get(`/projects?size=500`).then(r => setProjects(r.data.content || [])).catch(() => {});
  }, []);
  useEffect(() => { loadHourly(); loadRegister(); }, [month, year]);

  const hourlyRecords = register.filter((r) => r.payType === "HOURLY");

  const generateHourly = () => {
    setMsg(null);
    payrollApi.runHourlyPayrollBulk(month, year)
      .then((r: any) => { setMsg(`Hourly payroll: ${r.generated} generated, ${r.skipped} skipped.`); loadRegister(); load(); })
      .catch((e) => setMsg(e?.response?.data?.message || "Failed"));
  };
  const runBulk = () => {
    setMsg(null);
    payrollApi.runPayrollBulk(month, year)
      .then((r: any) => { setMsg(`Monthly payroll: ${r.generated} generated, ${r.skipped} skipped.`); load(); loadRegister(); })
      .catch((e) => setMsg(e?.response?.data?.message || "Failed"));
  };
  const runAlerts = () => {
    payrollApi.runAlerts().then((r: any) =>
      setMsg(`Alerts sent — overdue ${r.overduePayments}, final pending ${r.finalPaymentsPending}, closed w/ balance ${r.contractsClosedWithBalance}.`));
  };
  const approveRec = (id: number) => payrollApi.approvePayroll(id).then(loadRegister).catch((e) => setMsg(e?.response?.data?.message || "Failed"));
  const payRec = (id: number) => payrollApi.markPaid(id).then(() => { loadRegister(); load(); }).catch((e) => setMsg(e?.response?.data?.message || "Failed"));

  const submitAward = () => {
    if (!award.employeeId) { setMsg("Select an employee to award the bonus to."); return; }
    if (!award.amount || Number(award.amount) <= 0) { setMsg("Enter a bonus amount greater than zero."); return; }
    payrollApi.awardBonus(Number(award.employeeId), {
      bonusType: award.bonusType,
      amount: Number(award.amount),
      reason: award.reason || undefined,
      project: award.projectId ? { id: Number(award.projectId) } : undefined,
    })
      .then(() => {
        setAwardOpen(false);
        setAward({ employeeId: "", bonusType: "PROJECT_COMPLETION", amount: "", projectId: "", reason: "" });
        loadBonuses();
      })
      .catch((e) => setMsg(e?.response?.data?.message || "Failed to award bonus"));
  };

  const submitDeduction = () => {
    if (!ded.employeeId) { setMsg("Select an employee for the deduction."); return; }
    if (!ded.amount || Number(ded.amount) <= 0) { setMsg("Enter a deduction amount greater than zero."); return; }
    payrollApi.createDeduction(Number(ded.employeeId), {
      deductionType: ded.deductionType, amount: Number(ded.amount), reason: ded.reason || undefined,
    })
      .then(() => { setDedOpen(false); setDed({ employeeId: "", deductionType: "FINE", amount: "", reason: "" }); loadDeductions(); })
      .catch((e) => setMsg(e?.response?.data?.message || "Failed to add deduction"));
  };

  const openWage = () => { setWage({ employeeId: "" }); setWageOpen(true); };
  const onWageEmployee = (id: string) => {
    const e = employees.find((x) => String(x.id) === id) || {};
    setWage({
      employeeId: id,
      hourlyRate: e.hourlyRate ?? "", overtimeRate: e.overtimeRate ?? "", holidayRate: e.holidayRate ?? "",
      weekendRate: e.weekendRate ?? "", nightRate: e.nightRate ?? "",
      overtimeMultiplier: e.overtimeMultiplier ?? "1.5", standardDailyHours: e.standardDailyHours ?? "8",
      maxDailyHours: e.maxDailyHours ?? "", bonusEligible: e.bonusEligible ?? true,
      payrollCycle: e.payrollCycle ?? "MONTHLY", paymentMethod: e.paymentMethod ?? "",
      bankAccount: e.bankAccount ?? "", ifsc: e.ifsc ?? "",
    });
  };
  const submitWage = () => {
    if (!wage.employeeId) { setMsg("Select an employee."); return; }
    const numOrNull = (v: any) => (v === "" || v == null ? null : Number(v));
    const body: WageSettings = {
      salaryType: "HOURLY",
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
      .then(() => { setWageOpen(false); setMsg("Wage settings saved."); loadHourly();
        api.get(`/hr/employees?size=500`).then(r => setEmployees(r.data.content || [])).catch(() => {}); })
      .catch((e) => setMsg(e?.response?.data?.message || "Failed to save wage settings"));
  };

  if (loading || !d) return <div className="p-6 text-muted-foreground">Loading dashboard…</div>;

  const bonusStatusTone: Record<string, string> = {
    RECOMMENDED: "bg-purple-100 text-purple-700", PENDING: "bg-amber-100 text-amber-700",
    APPROVED: "bg-blue-100 text-blue-700", PAID: "bg-emerald-100 text-emerald-700", APPLIED: "bg-slate-200 text-slate-700",
  };
  const inputCls = "w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 bg-white border rounded-2xl p-4 shadow-sm">
        <div><label className="text-xs text-slate-500 block">Month</label><Input type="number" className="w-24" value={month} onChange={(e) => setMonth(Number(e.target.value))} /></div>
        <div><label className="text-xs text-slate-500 block">Year</label><Input type="number" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
        <Button onClick={generateHourly}><PlayCircle className="w-4 h-4 mr-1" /> Generate hourly payroll</Button>
        <Button variant="outline" onClick={runBulk}><Wallet className="w-4 h-4 mr-1" /> Run monthly payroll</Button>
        <Button variant="outline" onClick={openWage}><Settings2 className="w-4 h-4 mr-1" /> Wage settings</Button>
        <Button variant="outline" onClick={runAlerts}><Bell className="w-4 h-4 mr-1" /> Run payment alerts</Button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>

      <Section title="Employees" icon={<Users className="w-5 h-5 text-indigo-600" />}>
        <Tile label="Payroll due (this month)" value={inr(d.employee.payrollDue)} tone="amber" />
        <Tile label="Salary paid (this month)" value={inr(d.employee.salaryPaidThisMonth)} />
        <Tile label="Salary paid (YTD)" value={inr(d.employee.salaryPaidYtd)} />
        <Tile label="Advances outstanding" value={inr(d.employee.advancesOutstanding)} />
        <Tile label="Loans outstanding" value={inr(d.employee.loansOutstanding)} />
      </Section>

      <Section title="Contractors" icon={<HardHat className="w-5 h-5 text-amber-600" />}>
        <Tile label="Outstanding payments" value={inr(d.contractor.outstandingPayments)} tone="amber" />
        <Tile label="Upcoming payments" value={inr(d.contractor.upcomingPayments)} />
        <Tile label="Overdue payments" value={inr(d.contractor.overduePayments)} tone="rose" />
        <Tile label="Total contract value" value={inr(d.contractor.contractValue)} />
        <Tile label="Requests pending approval" value={String(d.contractor.paymentRequestsPendingApproval)} />
      </Section>

      {/* HOURLY PAYROLL — generate, approve, pay, payslip */}
      <div>
        <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-3"><BadgeIndianRupee className="w-5 h-5 text-emerald-600" /> Hourly Payroll — {monthName(month)} {year}</h3>
        <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Employee</th>
                <th className="text-right p-3">Days</th>
                <th className="text-right p-3">Hrs</th>
                <th className="text-right p-3">OT hrs</th>
                <th className="text-right p-3">Regular</th>
                <th className="text-right p-3">OT pay</th>
                <th className="text-right p-3">Proj bonus</th>
                <th className="text-right p-3">Manual</th>
                <th className="text-right p-3">Incentive</th>
                <th className="text-right p-3">Deduct</th>
                <th className="text-right p-3">Advance</th>
                <th className="text-right p-3">Net</th>
                <th className="text-center p-3">Status</th>
                <th className="text-center p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {hourlyRecords.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium text-slate-800 whitespace-nowrap">{empName(r.employee)}</td>
                  <td className="p-3 text-right text-slate-500">{r.attendanceDays ?? 0}</td>
                  <td className="p-3 text-right">{num(r.workedHours).toFixed(1)}</td>
                  <td className="p-3 text-right">{num(r.overtimeHours).toFixed(1)}</td>
                  <td className="p-3 text-right">{inr(r.regularEarnings)}</td>
                  <td className="p-3 text-right">{inr(r.overtimeAmount)}</td>
                  <td className="p-3 text-right">{inr(r.projectBonus)}</td>
                  <td className="p-3 text-right">{inr(r.manualBonus)}</td>
                  <td className="p-3 text-right">{inr(r.incentive)}</td>
                  <td className="p-3 text-right text-rose-600">{inr(num(r.manualDeduction))}</td>
                  <td className="p-3 text-right text-rose-600">{inr(r.advanceRecovery)}</td>
                  <td className="p-3 text-right font-bold text-emerald-600">{inr(r.netSalary)}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${bonusStatusTone[r.status] || "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
                  <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                    {r.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => approveRec(r.id)}><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>}
                    {r.status === "APPROVED" && <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => payRec(r.id)}><BadgeIndianRupee className="w-3.5 h-3.5 mr-1" /> Pay</Button>}
                    <Button size="sm" variant="ghost" onClick={() => window.open(`/hr/payslip/${r.id}`, "_blank")}><FileText className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {hourlyRecords.length === 0 && (
                <tr><td colSpan={14} className="text-center text-slate-400 py-10">No hourly payroll generated for this period. Set employees' hourly rates, then “Generate hourly payroll”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* HOURLY EARNINGS PREVIEW — live from attendance (before a run) */}
      <div>
        <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-3"><Clock className="w-5 h-5 text-cyan-600" /> Attendance earnings preview</h3>
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
                  <td className="p-3 font-medium text-slate-800">{r.employeeName}<div className="text-[11px] text-slate-400">{r.employeeCode}</div></td>
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
      </div>

      {/* MANUAL DEDUCTIONS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 font-bold text-slate-800"><MinusCircle className="w-5 h-5 text-rose-600" /> Manual Deductions</h3>
          <Dialog open={dedOpen} onOpenChange={setDedOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4 mr-1" /> Add Deduction</Button></DialogTrigger>
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
        </div>
        <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Employee</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Reason</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-center p-3">Status</th>
                <th className="text-center p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {deductions.map((b: any) => (
                <tr key={b.id} className="border-t">
                  <td className="p-3 font-medium text-slate-800">{empName(b.employee)}</td>
                  <td className="p-3">{DEDUCTION_LABEL[b.deductionType] || b.deductionType}</td>
                  <td className="p-3 text-slate-600">{b.reason || "—"}</td>
                  <td className="p-3 text-right font-bold text-rose-600">{inr(b.amount)}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${bonusStatusTone[b.status] || "bg-slate-100 text-slate-600"}`}>{b.status}</span></td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {b.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => payrollApi.approveDeduction(b.id).then(loadDeductions)}><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>}
                  </td>
                </tr>
              ))}
              {deductions.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">No manual deductions recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* EMPLOYEE BONUSES */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 font-bold text-slate-800"><Gift className="w-5 h-5 text-pink-600" /> Employee Bonuses</h3>
          <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Award Bonus</Button></DialogTrigger>
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
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Employee</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Project / Reason</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-center p-3">Status</th>
                <th className="text-center p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {bonuses.map((b: any) => (
                <tr key={b.id} className="border-t">
                  <td className="p-3 font-medium text-slate-800">{empName(b.employee)}</td>
                  <td className="p-3">{BONUS_LABEL[b.bonusType] || b.bonusType}</td>
                  <td className="p-3 text-slate-600">{b.project?.projectName || b.reason || "—"}</td>
                  <td className="p-3 text-right font-bold">{inr(b.amount)}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${bonusStatusTone[b.status] || "bg-slate-100 text-slate-600"}`}>{b.status}</span></td>
                  <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                    {(b.status === "PENDING" || b.status === "RECOMMENDED") && <Button size="sm" variant="outline" onClick={() => payrollApi.approveBonus(b.id).then(loadBonuses)}><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>}
                    {b.status !== "PAID" && <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => payrollApi.payBonus(b.id).then(loadBonuses)}><BadgeIndianRupee className="w-3.5 h-3.5 mr-1" /> Mark Paid</Button>}
                  </td>
                </tr>
              ))}
              {bonuses.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-10">No bonuses awarded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* WAGE SETTINGS DIALOG */}
      <Dialog open={wageOpen} onOpenChange={setWageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Hourly Wage Settings</DialogTitle></DialogHeader>
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
                <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthName(m: number) { return MONTHS[m] || String(m); }

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-3">{icon}{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "amber" | "rose" }) {
  const bg = tone === "amber" ? "bg-amber-50 border-amber-200" : tone === "rose" ? "bg-rose-50 border-rose-200" : "bg-white";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${bg}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
