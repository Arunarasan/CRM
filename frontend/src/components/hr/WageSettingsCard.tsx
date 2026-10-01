import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import WageSettingsDialog from "./WageSettingsDialog";

const n = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? 0 : Number(v));
const inr = (v: any) => "₹" + n(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * Wage & pay basis summary on the employee profile's Payroll tab. Editing opens the shared
 * {@link WageSettingsDialog} (same editor as the payroll page, with live pay preview).
 */
export default function WageSettingsCard({
  employee, employeeId, onSaved,
}: { employee: any; employeeId: number; onSaved?: () => void }) {
  const [open, setOpen] = useState(false);

  const monthly = (employee?.salaryType || "HOURLY").toUpperCase() === "MONTHLY";
  const daily = n(employee?.standardDailyHours) || 8;
  const days = n(employee?.workingDaysPerMonth) || 26;
  const std = daily * days;
  const salary = n(employee?.baseSalary);
  const rate = n(employee?.hourlyRate) > 0 ? n(employee.hourlyRate) : std > 0 && salary > 0 ? salary / std : 0;
  const ot = n(employee?.overtimeRate) > 0 ? n(employee.overtimeRate) : rate * (n(employee?.overtimeMultiplier) || 1.5);
  const configured = salary > 0 || n(employee?.hourlyRate) > 0;

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-800">Wage &amp; pay basis</h3>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Settings2 className="w-4 h-4 mr-1.5" /> {configured ? "Edit" : "Set pay"}
        </Button>
      </div>

      {configured ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <KV label="Usual basis" value={monthly ? "Monthly" : "Hourly"} />
          <KV label="Monthly salary" value={salary > 0 ? inr(salary) : "—"} />
          <KV label="Rate / hr" value={rate > 0 ? `${inr(rate)}${n(employee?.hourlyRate) > 0 ? "" : " (from salary)"}` : "—"} />
          <KV label="Overtime / hr" value={ot > 0 ? inr(ot) : "—"} />
          <KV label="Standard month" value={`${std} h (${daily} h × ${days} days)`} />
          <KV label="Weekend / hr" value={n(employee?.weekendRate) > 0 ? inr(employee.weekendRate) : "Same as weekday"} />
          <KV label="Payment" value={[(employee?.paymentMethod || "").replace(/_/g, " "), employee?.bankAccount, employee?.ifsc].filter(Boolean).join(" · ") || "—"} />
          <KV label="Bonus eligible" value={employee?.bonusEligible ? "Yes" : "No"} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No pay set yet. Add a monthly salary or an hourly rate so payslips can be generated from this employee's hours.
        </p>
      )}

      <WageSettingsDialog open={open} onClose={() => setOpen(false)} employee={employee} employeeId={employeeId} onSaved={onSaved} />
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  );
}
