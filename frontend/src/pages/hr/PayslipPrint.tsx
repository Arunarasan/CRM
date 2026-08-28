import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { payrollApi } from "@/api/payrollApi";
import { useGoBack } from "@/hooks/useGoBack";
import type { SalaryRecord } from "@/types/payroll";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PayslipPrint() {
  const { id } = useParams();
  const goBack = useGoBack("/workforce/payroll");
  const [rec, setRec] = useState<SalaryRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    payrollApi.payslip(Number(id)).then((r) => setRec(r.record)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!rec) return <div className="p-8 text-center text-muted-foreground">Payslip not found.</div>;

  const emp = rec.employee || {};
  const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "Employee";
  const hourly = rec.payType === "HOURLY";

  const earnings: [string, number][] = hourly
    ? [
        ["Regular earnings", rec.regularEarnings ?? 0], ["Overtime pay", rec.overtimeAmount],
        ["Project bonus", rec.projectBonus ?? 0], ["Manual bonus", rec.manualBonus ?? 0],
        ["Incentive", rec.incentive],
      ]
    : [
        ["Basic", rec.basic], ["HRA", rec.hra], ["Allowances", rec.allowances],
        ["Overtime", rec.overtimeAmount], ["Bonus", rec.bonus], ["Incentive", rec.incentive],
      ];
  const deductions: [string, number][] = hourly
    ? [
        ["Manual deduction", rec.manualDeduction ?? 0], ["Advance recovery", rec.advanceRecovery],
        ["Loan recovery", rec.loanRecovery],
      ]
    : [
        ["PF", rec.pfAmount], ["ESI", rec.esiAmount], ["Professional tax", rec.professionalTax],
        ["Leave (LOP)", rec.leaveDeduction], ["Advance recovery", rec.advanceRecovery], ["Loan recovery", rec.loanRecovery],
      ];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button type="button" onClick={goBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print / Save PDF</Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Arudra CRM</h1>
            <p className="text-sm text-muted-foreground">Payslip — {MONTHS[rec.month]} {rec.year}</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono text-xs text-slate-500">{rec.payslipNumber}</div>
            <div className="font-semibold">{name}</div>
            <div className="text-muted-foreground">{emp.employeeCode || ""}</div>
          </div>
        </div>

        {hourly ? (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-sm mb-6">
            <KV label="Attendance days" value={rec.attendanceDays ?? "—"} />
            <KV label="Worked hrs" value={rec.workedHours ?? "—"} />
            <KV label="Overtime hrs" value={rec.overtimeHours ?? "—"} />
            <KV label="Hourly rate" value={rec.hourlyRate != null ? inr(rec.hourlyRate) : "—"} />
            <KV label="OT rate" value={rec.overtimeRate != null ? inr(rec.overtimeRate) : "—"} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-sm mb-6">
            <KV label="Working days" value={rec.workingDays ?? "—"} />
            <KV label="Paid days" value={rec.paidDays ?? "—"} />
            <KV label="LOP days" value={rec.lopDays ?? "—"} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <Column title="Earnings" rows={earnings} total={rec.grossEarnings} />
          <Column title="Deductions" rows={deductions} total={rec.totalDeductions} />
        </div>

        <div className="mt-6 flex items-center justify-between bg-slate-50 border rounded-xl p-4">
          <span className="font-bold text-slate-800">Net Pay</span>
          <span className="text-2xl font-bold text-emerald-700">{inr(rec.netSalary)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Status: {rec.status}{rec.paymentDate ? ` · Paid on ${rec.paymentDate}` : ""}
        </p>
      </div>
    </div>
  );
}

function Column({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div>
      <h3 className="font-bold text-slate-700 mb-2">{title}</h3>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {rows.filter(([, v]) => Number(v) !== 0).map(([k, v]) => (
            <tr key={k}><td className="py-1.5 text-slate-600">{k}</td><td className="py-1.5 text-right font-medium">{inr(v)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2"><td className="py-2 font-bold">Total</td><td className="py-2 text-right font-bold">{inr(total)}</td></tr></tfoot>
      </table>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-xs text-slate-500">{label}</div><div className="font-semibold">{value}</div></div>;
}
