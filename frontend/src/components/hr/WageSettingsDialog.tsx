import { useEffect, useMemo, useState } from "react";
import { payrollApi } from "@/api/payrollApi";
import type { PayrollPreviewRow, WageSettings } from "@/types/payroll";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, BaseInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SearchableSelect from "@/components/ui/searchable-select";
import { ChevronDown, Clock, Wallet, Landmark, Sparkles } from "lucide-react";

const inputCls = "w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm";
const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const n = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? 0 : Number(v));
const inr = (v: any) => "₹" + n(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const numOrNull = (v: any) => (v === "" || v == null ? null : Number(v));
const empName = (e: any) => [e?.firstName, e?.lastName].filter(Boolean).join(" ") || e?.name || "Employee";

function formFrom(e: any) {
  return {
    salaryType: (e?.salaryType || "HOURLY").toUpperCase() === "MONTHLY" ? "MONTHLY" : "HOURLY",
    baseSalary: n(e?.baseSalary) > 0 ? e.baseSalary : "",
    hourlyRate: e?.hourlyRate ?? "",
    overtimeRate: e?.overtimeRate ?? "",
    weekendRate: e?.weekendRate ?? "",
    overtimeMultiplier: e?.overtimeMultiplier ?? "1.5",
    standardDailyHours: e?.standardDailyHours ?? "8",
    workingDaysPerMonth: e?.workingDaysPerMonth ?? "26",
    maxDailyHours: e?.maxDailyHours ?? "",
    bonusEligible: e?.bonusEligible ?? true,
    paymentMethod: e?.paymentMethod ?? "",
    bankAccount: e?.bankAccount ?? "",
    ifsc: e?.ifsc ?? "",
  };
}
type Form = ReturnType<typeof formFrom>;

function toBody(f: Form): WageSettings {
  return {
    salaryType: f.salaryType,
    baseSalary: numOrNull(f.baseSalary) ?? 0,
    hourlyRate: numOrNull(f.hourlyRate),
    overtimeRate: numOrNull(f.overtimeRate),
    weekendRate: numOrNull(f.weekendRate),
    overtimeMultiplier: f.overtimeMultiplier ? Number(f.overtimeMultiplier) : 1.5,
    standardDailyHours: f.standardDailyHours ? Number(f.standardDailyHours) : 8,
    workingDaysPerMonth: f.workingDaysPerMonth ? Number(f.workingDaysPerMonth) : 26,
    maxDailyHours: numOrNull(f.maxDailyHours),
    bonusEligible: !!f.bonusEligible,
    paymentMethod: f.paymentMethod || null,
    bankAccount: f.bankAccount || undefined,
    ifsc: f.ifsc || undefined,
  };
}

function validate(f: Form): string | null {
  if (n(f.baseSalary) < 0 || n(f.hourlyRate) < 0) return "Salary and rates can't be negative.";
  if (n(f.standardDailyHours) <= 0 || n(f.standardDailyHours) > 24) return "Standard hours per day must be between 1 and 24.";
  if (n(f.workingDaysPerMonth) < 1 || n(f.workingDaysPerMonth) > 31) return "Working days per month must be between 1 and 31.";
  if (f.salaryType === "MONTHLY" && n(f.baseSalary) <= 0) return "Enter a monthly salary for the Monthly basis.";
  if (f.salaryType === "HOURLY" && n(f.hourlyRate) <= 0 && n(f.baseSalary) <= 0) return "Enter an hourly rate (or a monthly salary to derive it from).";
  return null;
}

/**
 * Wage & pay basis for one employee — the single editor used by the payroll page and the employee
 * profile. Sections: Pay → Hours & overtime (advanced collapsed) → Payment. A live preview prices the
 * employee's real hours for the period with the values being typed (POST /hr/employees/{id}/wage-preview,
 * nothing saved), so HR sees the rupee effect before saving.
 */
export default function WageSettingsDialog({
  open, onClose, onSaved, employeeId, employee, employees, month, year,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** Pre-selected employee (payroll row ⚙ / profile). */
  employeeId?: number | null;
  /** The employee record when the caller already has it (profile page). */
  employee?: any;
  /** Pass to show a searchable employee picker (payroll page). */
  employees?: any[];
  month?: number;
  year?: number;
}) {
  const now = new Date();
  const pm = month ?? now.getMonth() + 1;
  const py = year ?? now.getFullYear();

  const [empId, setEmpId] = useState<string>("");
  const [form, setForm] = useState<Form>(formFrom(null));
  const [advanced, setAdvanced] = useState(false);
  const [preview, setPreview] = useState<PayrollPreviewRow | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const record = useMemo(
    () => employee ?? employees?.find((e) => String(e.id) === empId) ?? null,
    [employee, employees, empId],
  );

  // (Re)initialise when opened or the employee changes.
  useEffect(() => {
    if (!open) return;
    setEmpId(employeeId != null ? String(employeeId) : employee?.id != null ? String(employee.id) : "");
  }, [open, employeeId, employee]);
  useEffect(() => {
    if (!open) return;
    const f = formFrom(record);
    setForm(f);
    setAdvanced(!!(record && (record.overtimeRate != null || record.weekendRate != null || record.maxDailyHours != null)));
    setPreview(null);
  }, [open, record]);

  // Debounced live preview from the server (real attendance hours × the draft settings).
  useEffect(() => {
    if (!open || !empId) return;
    setPreviewing(true);
    const t = setTimeout(() => {
      payrollApi.wagePreview(Number(empId), pm, py, toBody(form))
        .then(setPreview).catch(() => setPreview(null)).finally(() => setPreviewing(false));
    }, 400);
    return () => clearTimeout(t);
  }, [open, empId, form, pm, py]);

  const set = (k: keyof Form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // Instant client-side figures (no round-trip) for the rate summary.
  const stdHours = n(form.standardDailyHours) * n(form.workingDaysPerMonth);
  const salaryPerHour = stdHours > 0 && n(form.baseSalary) > 0 ? n(form.baseSalary) / stdHours : 0;
  const effHourly = n(form.hourlyRate) > 0 ? n(form.hourlyRate) : salaryPerHour;
  const otRate = n(form.overtimeRate) > 0 ? n(form.overtimeRate) : effHourly * (n(form.overtimeMultiplier) || 1.5);

  const save = () => {
    if (!empId) { toast.error("Select an employee."); return; }
    const err = validate(form);
    if (err) { toast.error(err); return; }
    setSaving(true);
    payrollApi.saveWageSettings(Number(empId), toBody(form))
      .then(() => { toast.success("Wage settings saved."); onSaved?.(); onClose(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to save wage settings"))
      .finally(() => setSaving(false));
  };

  const options = useMemo(
    () => (employees ?? []).map((e) => ({ value: String(e.id), label: empName(e), hint: e.employeeCode || e.designation })),
    [employees],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle>Wage &amp; pay basis</DialogTitle>
          {employees ? (
            <SearchableSelect value={empId} onChange={setEmpId} options={options} placeholder="Search employee…" className="mt-2" />
          ) : record && (
            <p className="text-sm text-slate-500">{empName(record)}{record.employeeCode ? ` · ${record.employeeCode}` : ""}</p>
          )}
        </DialogHeader>

        {!empId ? (
          <p className="p-8 text-center text-sm text-slate-400">Pick an employee to edit their pay.</p>
        ) : (
          <>
            <div className="grid md:grid-cols-[1fr_250px] max-h-[68vh] overflow-y-auto">
              {/* ---------------- form ---------------- */}
              <div className="p-5 space-y-5">
                <Section icon={<Wallet className="w-4 h-4" />} title="Pay">
                  <div>
                    <Label className="text-xs">Usual pay basis</Label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {(["HOURLY", "MONTHLY"] as const).map((b) => (
                        <button key={b} type="button" onClick={() => set("salaryType", b)}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${form.salaryType === b
                            ? (b === "HOURLY" ? "border-cyan-500 bg-cyan-50 ring-1 ring-cyan-500" : "border-violet-500 bg-violet-50 ring-1 ring-violet-500")
                            : "bg-white hover:bg-slate-50"}`}>
                          <div className={`text-sm font-bold ${b === "HOURLY" ? "text-cyan-700" : "text-violet-700"}`}>{b === "HOURLY" ? "Hourly" : "Monthly"}</div>
                          <div className="text-[11px] text-slate-500">{b === "HOURLY" ? "hours × hourly rate" : "salary ÷ standard hours × hours worked"}</div>
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">Pre-selected on the Generate screen — you can still choose the other one in any month.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Monthly salary (₹)" hint={form.salaryType === "MONTHLY" ? "required" : "optional"}>
                      <Input type="number" min={0} value={form.baseSalary} onChange={(e) => set("baseSalary", e.target.value)} placeholder="e.g. 20800" />
                    </Field>
                    <Field label="Hourly rate (₹)" hint={form.salaryType === "HOURLY" && salaryPerHour <= 0 ? "required" : "optional"}>
                      <Input type="number" min={0} value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)}
                        placeholder={salaryPerHour > 0 ? `${inr(salaryPerHour)} from salary` : "e.g. 250"} />
                    </Field>
                  </div>
                </Section>

                <Section icon={<Clock className="w-4 h-4" />} title="Hours & overtime">
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Hours / day"><Input type="number" min={1} max={24} value={form.standardDailyHours} onChange={(e) => set("standardDailyHours", e.target.value)} /></Field>
                    <Field label="Working days / month"><Input type="number" min={1} max={31} value={form.workingDaysPerMonth} onChange={(e) => set("workingDaysPerMonth", e.target.value)} /></Field>
                    <Field label="OT multiplier"><Input type="number" min={1} step="0.25" value={form.overtimeMultiplier} onChange={(e) => set("overtimeMultiplier", e.target.value)} /></Field>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Standard month = <b>{stdHours || 0} h</b>. Hours beyond {n(form.standardDailyHours) || 8} in a day are overtime.
                    Use 26 days for a 6-day week, 22 for a 5-day week.
                  </p>
                  <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex items-center gap-1 text-xs font-semibold text-primary">
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advanced ? "rotate-180" : ""}`} /> Advanced rates
                  </button>
                  {advanced && (
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Fixed OT rate (₹/h)"><Input type="number" min={0} value={form.overtimeRate} onChange={(e) => set("overtimeRate", e.target.value)} placeholder="× multiplier" /></Field>
                      <Field label="Weekend rate (₹/h)"><Input type="number" min={0} value={form.weekendRate} onChange={(e) => set("weekendRate", e.target.value)} placeholder="same as weekday" /></Field>
                      <Field label="Max hours / day"><Input type="number" min={1} max={24} value={form.maxDailyHours} onChange={(e) => set("maxDailyHours", e.target.value)} placeholder="no cap" /></Field>
                    </div>
                  )}
                </Section>

                <Section icon={<Landmark className="w-4 h-4" />} title="Payment">
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Method">
                      <select className={inputCls} value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
                        <option value="">—</option>
                        {["BANK_TRANSFER", "UPI", "CASH", "CHEQUE"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                      </select>
                    </Field>
                    <Field label="Bank account"><Input value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} /></Field>
                    <Field label="IFSC"><Input value={form.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase())} /></Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <BaseInput type="checkbox" checked={!!form.bonusEligible} onChange={(e) => set("bonusEligible", e.target.checked)} />
                    Approved bonuses &amp; incentives are added to their payslip
                  </label>
                </Section>
              </div>

              {/* ---------------- live preview ---------------- */}
              <aside className="border-t md:border-t-0 md:border-l bg-slate-50 p-5 space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <Sparkles className="w-3.5 h-3.5" /> Live preview
                </div>
                <div className="space-y-1.5 text-sm">
                  <Row label="Standard month" value={`${stdHours || 0} h`} />
                  <Row label="Hourly rate" value={effHourly > 0 ? `${inr(effHourly)}${n(form.hourlyRate) > 0 ? "" : " *"}` : "—"} />
                  <Row label="Overtime rate" value={otRate > 0 ? inr(otRate) : "—"} />
                  {n(form.hourlyRate) <= 0 && salaryPerHour > 0 && <p className="text-[10px] text-slate-400">* from monthly salary</p>}
                </div>

                <div className="rounded-xl border bg-white p-3">
                  <div className="text-[11px] font-semibold text-slate-500">{MONTHS[pm]} {py} · from attendance</div>
                  {!preview ? (
                    <p className="mt-2 text-xs text-slate-400">{previewing ? "Calculating…" : "No preview."}</p>
                  ) : (
                    <>
                      <div className="mt-1 text-sm text-slate-700">
                        <b>{n(preview.workedHours)} h</b> in {preview.attendanceDays} days
                        {n(preview.overtimeHours) > 0 && <span className="text-slate-500"> · {n(preview.overtimeHours)} h OT</span>}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <PreviewPay label="Hourly" tone="cyan" active={form.salaryType === "HOURLY"} value={preview.hourly.available ? preview.hourly.total : null} />
                        <PreviewPay label="Monthly" tone="violet" active={form.salaryType === "MONTHLY"} value={preview.monthly.available ? preview.monthly.total : null} />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400">Base pay before bonuses, deductions and recoveries.{previewing ? " Updating…" : ""}</p>
                    </>
                  )}
                </div>
              </aside>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><span className="text-slate-400">{icon}</span>{title}</h4>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{hint && <span className="ml-1 font-normal text-slate-400">({hint})</span>}</Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-2"><span className="text-slate-500">{label}</span><b className="text-slate-800">{value}</b></div>;
}

function PreviewPay({ label, value, active, tone }: { label: string; value: number | null | undefined; active: boolean; tone: "cyan" | "violet" }) {
  const ring = tone === "cyan" ? "border-cyan-500 bg-cyan-50" : "border-violet-500 bg-violet-50";
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${active ? ring : "bg-white"}`}>
      <div className={`text-[10px] font-bold uppercase ${tone === "cyan" ? "text-cyan-700" : "text-violet-700"}`}>{label}</div>
      <div className="text-sm font-bold text-slate-900">{value == null ? "—" : inr(value)}</div>
    </div>
  );
}
