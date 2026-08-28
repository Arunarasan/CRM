import { useState } from "react";
import { payrollApi } from "@/api/payrollApi";
import type { WageSettings } from "@/types/payroll";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings2 } from "lucide-react";

const inputCls = "w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm";
const rate = (v: any) => (v == null || v === "" ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);

/**
 * Per-employee hourly wage configuration (rates, multipliers, cycle, payment).
 * Shown on the employee profile's Payroll tab so HR can set rates in context —
 * mirrors the "Wage settings" dialog on the HR payroll dashboard.
 */
export default function WageSettingsCard({
  employee, employeeId, onSaved,
}: { employee: any; employeeId: number; onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  const hasRate = employee?.hourlyRate != null && employee?.hourlyRate !== "";

  const openDialog = () => {
    setForm({
      salaryType: employee.salaryType || "HOURLY",
      hourlyRate: employee.hourlyRate ?? "", overtimeRate: employee.overtimeRate ?? "",
      weekendRate: employee.weekendRate ?? "", holidayRate: employee.holidayRate ?? "",
      nightRate: employee.nightRate ?? "",
      overtimeMultiplier: employee.overtimeMultiplier ?? "1.5",
      standardDailyHours: employee.standardDailyHours ?? "8", maxDailyHours: employee.maxDailyHours ?? "",
      bonusEligible: employee.bonusEligible ?? true,
      payrollCycle: employee.payrollCycle ?? "MONTHLY", paymentMethod: employee.paymentMethod ?? "",
      bankAccount: employee.bankAccount ?? "", ifsc: employee.ifsc ?? "",
    });
    setOpen(true);
  };

  const save = () => {
    const numOrNull = (v: any) => (v === "" || v == null ? null : Number(v));
    const body: WageSettings = {
      salaryType: form.salaryType || "HOURLY",
      hourlyRate: numOrNull(form.hourlyRate), overtimeRate: numOrNull(form.overtimeRate),
      holidayRate: numOrNull(form.holidayRate), weekendRate: numOrNull(form.weekendRate),
      nightRate: numOrNull(form.nightRate),
      overtimeMultiplier: form.overtimeMultiplier ? Number(form.overtimeMultiplier) : undefined,
      standardDailyHours: form.standardDailyHours ? Number(form.standardDailyHours) : undefined,
      maxDailyHours: numOrNull(form.maxDailyHours), bonusEligible: !!form.bonusEligible,
      payrollCycle: form.payrollCycle || "MONTHLY", paymentMethod: form.paymentMethod || null,
      bankAccount: form.bankAccount || undefined, ifsc: form.ifsc || undefined,
    };
    setSaving(true);
    payrollApi.saveWageSettings(employeeId, body)
      .then(() => { setOpen(false); toast.success("Wage settings saved."); onSaved?.(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to save wage settings"))
      .finally(() => setSaving(false));
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-800">Wage &amp; pay basis</h3>
        <Button variant="outline" size="sm" onClick={openDialog}>
          <Settings2 className="w-4 h-4 mr-1.5" /> {hasRate ? "Edit" : "Set rates"}
        </Button>
      </div>

      {hasRate ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <KV label="Pay basis" value={(employee.salaryType || "HOURLY") === "MONTHLY" ? "Monthly" : "Hourly"} />
          <KV label="Rate / hr" value={rate(employee.hourlyRate)} />
          <KV label="Overtime / hr" value={employee.overtimeRate != null ? rate(employee.overtimeRate) : `× ${employee.overtimeMultiplier ?? "1.5"}`} />
          <KV label="Weekend / hr" value={rate(employee.weekendRate)} />
          <KV label="Holiday / hr" value={rate(employee.holidayRate)} />
          <KV label="Night / hr" value={rate(employee.nightRate)} />
          <KV label="Standard hrs/day" value={employee.standardDailyHours ?? "8"} />
          <KV label="Max hrs/day" value={employee.maxDailyHours ?? "—"} />
          <KV label="Payroll cycle" value={employee.payrollCycle ?? "MONTHLY"} />
          <KV label="Payment method" value={(employee.paymentMethod || "—").replace(/_/g, " ")} />
          <KV label="Bank" value={[employee.bankAccount, employee.ifsc].filter(Boolean).join(" · ") || "—"} />
          <KV label="Bonus eligible" value={employee.bonusEligible ? "Yes" : "No"} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Pay basis: <b>{(employee.salaryType || "HOURLY") === "MONTHLY" ? "Monthly" : "Hourly"}</b>.{" "}
          {(employee.salaryType || "HOURLY") === "MONTHLY"
            ? <>Paid by salary structure via <b>Run monthly salary</b>.</>
            : <>No hourly rate set — set one so this employee is picked up by <b>Run hourly pay</b>.</>}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Wage &amp; pay basis</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs">Pay basis</Label>
              <select className={inputCls} value={form.salaryType || "HOURLY"} onChange={(e) => setForm({ ...form, salaryType: e.target.value })}>
                <option value="HOURLY">Hourly — paid by attendance hours × rate</option>
                <option value="MONTHLY">Monthly — paid by salary structure</option>
              </select>
              <p className="text-xs text-slate-400">
                {form.salaryType === "MONTHLY"
                  ? "Generated by “Run monthly salary” from the salary structure. Hourly rates below are ignored."
                  : "Generated by “Run hourly pay” from the rates below."}
              </p>
            </div>
            <div className={`grid grid-cols-2 gap-3 ${form.salaryType === "MONTHLY" ? "opacity-50" : ""}`}>
              <Field label="Hourly Rate (₹)"><Input type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></Field>
              <Field label="Overtime Rate (₹/hr)"><Input type="number" value={form.overtimeRate} onChange={(e) => setForm({ ...form, overtimeRate: e.target.value })} placeholder="blank = rate × OT mult" /></Field>
              <Field label="Weekend Rate (₹/hr)"><Input type="number" value={form.weekendRate} onChange={(e) => setForm({ ...form, weekendRate: e.target.value })} placeholder="optional" /></Field>
              <Field label="Holiday Rate (₹/hr)"><Input type="number" value={form.holidayRate} onChange={(e) => setForm({ ...form, holidayRate: e.target.value })} placeholder="optional" /></Field>
              <Field label="Night Rate (₹/hr)"><Input type="number" value={form.nightRate} onChange={(e) => setForm({ ...form, nightRate: e.target.value })} placeholder="optional" /></Field>
              <Field label="OT Multiplier"><Input type="number" value={form.overtimeMultiplier} onChange={(e) => setForm({ ...form, overtimeMultiplier: e.target.value })} /></Field>
              <Field label="Standard Daily Hours"><Input type="number" value={form.standardDailyHours} onChange={(e) => setForm({ ...form, standardDailyHours: e.target.value })} /></Field>
              <Field label="Max Daily Hours"><Input type="number" value={form.maxDailyHours} onChange={(e) => setForm({ ...form, maxDailyHours: e.target.value })} placeholder="optional cap" /></Field>
              <Field label="Payroll Cycle">
                <select className={inputCls} value={form.payrollCycle} onChange={(e) => setForm({ ...form, payrollCycle: e.target.value })}>
                  {["MONTHLY", "WEEKLY", "BIWEEKLY"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Payment Method">
                <select className={inputCls} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="">—</option>
                  {["BANK_TRANSFER", "CASH", "CHEQUE", "UPI"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Bank Account"><Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></Field>
              <Field label="IFSC"><Input value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={!!form.bonusEligible} onChange={(e) => setForm({ ...form, bonusEligible: e.target.checked })} /> Eligible for bonuses
            </label>
            <Button className="w-full" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Wage Settings"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  );
}
