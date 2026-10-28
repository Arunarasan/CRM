import { useEffect, useMemo, useState } from "react";
import { Play, Plus, Save, Trash2, X } from "lucide-react";
import api from "@/lib/api";
import { payrollApi, type PayslipDefaultLine, type PayslipSettings } from "@/api/payrollApi";
import { buildPayslipHtml } from "@/pages/employeePortal/printPayslip";
import type { Payslip } from "@/types/employeePortal";
import { MONTHS } from "@/pages/workforce/hrUi";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import SearchableSelect from "@/components/ui/searchable-select";

const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;
const select = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60";

/** A made-up payslip so the template preview shows every section. */
const SAMPLE: Payslip = {
  id: 0, month: 10, year: 2026, payslipNumber: "PS-202610-0", status: "PENDING", payType: "MONTHLY",
  standardHours: 208, monthlySalary: 20800, workedHours: 190, overtimeHours: 6, attendanceDays: 24,
  regularEarnings: 19000, overtimeAmount: 900, grossEarnings: 21400, totalDeductions: 1500, netSalary: 19900,
  lineItems: [
    { id: 1, category: "EARNING", label: "Travel allowance", amount: 1500, source: "PRESET" },
    { id: 2, category: "DEDUCTION", label: "PF — 12%", amount: 1500, source: "PRESET" },
  ],
} as unknown as Payslip;
const SAMPLE_EMP = {
  employeeName: "Sample Employee", employeeCode: "EMP-001", designation: "Site Supervisor",
  department: "Operations", dateOfJoining: "2024-04-01", bankAccount: "123456789012",
};

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mb-4 text-sm text-slate-500">{sub}</p>
      {children}
    </section>
  );
}

function Toggle({ label, hint, checked, onChange, disabled }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-sm text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

function TextField({ label, value, onChange, hint, disabled, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; disabled?: boolean; maxLength?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={maxLength} />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/**
 * Payslip settings: when payslips are made automatically, the allowance/deduction lines every payslip
 * starts with, how the printed payslip looks, and when employees get to see it. Applies to payslips
 * generated from now on; existing ones keep their lines (delete + regenerate to pick the presets up).
 */
export default function PayslipSettingsTab({ canEdit, month, year }: { canEdit: boolean; month: number; year: number }) {
  const [form, setForm] = useState<PayslipSettings | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [employees, setEmployees] = useState<{ id: number; name: string; code?: string }[]>([]);
  const [html, setHtml] = useState("");

  useEffect(() => {
    payrollApi.payslipSettings()
      .then((s) => { setForm(s); setSaved(JSON.stringify(s)); })
      .catch((e) => toast.error(errMsg(e, "Could not load payslip settings")));
    api.get("/hr/employees?size=500")
      .then((r) => setEmployees((r.data.content || []).map((e: any) => ({
        id: e.id, name: [e.firstName, e.lastName].filter(Boolean).join(" ") || `Employee #${e.id}`, code: e.employeeCode,
      }))))
      .catch(() => {});
  }, []);

  const tplKey = form ? JSON.stringify(form.template) : "";
  useEffect(() => {
    if (!form) return;
    let live = true;
    buildPayslipHtml(SAMPLE, SAMPLE_EMP, form.template).then((h) => { if (live) setHtml(h); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplKey]);

  const empOptions = useMemo(
    () => employees.map((e) => ({ value: String(e.id), label: e.name, hint: e.code })),
    [employees],
  );

  if (!form) return <Skeleton className="h-64 w-full" />;

  const dirty = JSON.stringify(form) !== saved;
  const ro = !canEdit;
  const setAuto = (p: Partial<PayslipSettings["auto"]>) => setForm({ ...form, auto: { ...form.auto, ...p } });
  const setTpl = (p: Partial<PayslipSettings["template"]>) => setForm({ ...form, template: { ...form.template, ...p } });
  const setVis = (p: Partial<PayslipSettings["visibility"]>) => setForm({ ...form, visibility: { ...form.visibility, ...p } });
  const setLine = (i: number, p: Partial<PayslipDefaultLine>) =>
    setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const addLine = () => setForm({
    ...form,
    lines: [...form.lines, { label: "", category: "EARNING", type: "FIXED", value: 0, enabled: true, employeeIds: [], basis: "" }],
  });
  const empName = (id: number) => employees.find((e) => e.id === id)?.name || `#${id}`;

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const r = await payrollApi.savePayslipSettings(form);
      setForm(r); setSaved(JSON.stringify(r));
      toast.success("Payslip settings saved");
    } catch (e) {
      toast.error(errMsg(e, "Could not save payslip settings"));
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (dirty) { toast.error("Save your changes first."); return; }
    setRunning(true);
    try {
      const r = await payrollApi.runAutoGenerateNow(month, year);
      toast.success(r.summary);
      const s = await payrollApi.payslipSettings();
      setForm(s); setSaved(JSON.stringify(s));
    } catch (e) {
      toast.error(errMsg(e, "Could not generate payslips"));
    } finally {
      setRunning(false);
    }
  }

  const a = form.auto;
  const t = form.template;

  return (
    <div className="space-y-4">
      {/* ---------- 1. auto-generate ---------- */}
      <Card title="Auto-generate" sub="Make the month's payslips automatically. They are created as drafts (awaiting approval) — nothing is approved or paid for you.">
        <Toggle label="Generate payslips automatically" checked={a.enabled} onChange={(v) => setAuto({ enabled: v })} disabled={ro} />
        <div className={`mt-3 grid gap-4 sm:grid-cols-3 ${a.enabled ? "" : "opacity-60"}`}>
          <div className="space-y-1">
            <Label className="text-sm">Run on day</Label>
            <Input type="number" min={1} max={28} value={a.dayOfMonth} disabled={ro || !a.enabled}
              onChange={(e) => setAuto({ dayOfMonth: Number(e.target.value) })} />
            <p className="text-xs text-slate-500">1–28. If the server was off that day, it runs when it is next up.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">For month</Label>
            <select className={select} value={a.period} disabled={ro || !a.enabled}
              onChange={(e) => setAuto({ period: e.target.value as any })}>
              <option value="PREVIOUS">The month that just ended</option>
              <option value="CURRENT">The current month</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Pay basis</Label>
            <select className={select} value={a.basis} disabled={ro || !a.enabled}
              onChange={(e) => setAuto({ basis: e.target.value as any })}>
              <option value="AUTO">Each employee's usual basis</option>
              <option value="HOURLY">Hourly for everyone</option>
              <option value="MONTHLY">Monthly salary for everyone</option>
            </select>
          </div>
        </div>
        <div className="mt-2">
          <Toggle label="Notify HR when it runs" hint="A summary: how many were made, skipped or failed." checked={a.notifyHr}
            onChange={(v) => setAuto({ notifyHr: v })} disabled={ro || !a.enabled} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
          <span>
            {a.lastRunPeriod ? <>Last run: <b>{a.lastRunSummary}</b></> : "Hasn't run yet."}
          </span>
          {canEdit && (
            <Button size="sm" variant="outline" className="ml-auto" disabled={running} onClick={runNow}>
              <Play className="mr-1 h-3.5 w-3.5" /> {running ? "Running…" : `Run now for ${MONTHS[month - 1]} ${year}`}
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          It only fills in employees who have no payslip for the month, so running again never duplicates or overwrites one.
        </p>
      </Card>

      {/* ---------- 2. default lines ---------- */}
      <Card title="Default lines" sub="Allowances and deductions added to every generated payslip. HR can still edit or remove them on a payslip afterwards.">
        {form.lines.length === 0 && <p className="mb-3 text-sm text-slate-500">No default lines yet.</p>}
        <div className="space-y-3">
          {form.lines.map((l, i) => (
            <div key={l.id ?? `new-${i}`} className={`rounded-lg border p-3 ${l.enabled ? "border-slate-200" : "border-slate-200 bg-slate-50"}`}>
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <Label className="text-xs">Name</Label>
                  <Input value={l.label} placeholder="e.g. Travel allowance" disabled={ro} maxLength={100}
                    onChange={(e) => setLine(i, { label: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Kind</Label>
                  <select className={select} value={l.category} disabled={ro} onChange={(e) => setLine(i, { category: e.target.value as any })}>
                    <option value="EARNING">Earning</option>
                    <option value="DEDUCTION">Deduction</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Amount type</Label>
                  <select className={select} value={l.type} disabled={ro} onChange={(e) => setLine(i, { type: e.target.value as any })}>
                    <option value="FIXED">Fixed ₹</option>
                    <option value="PERCENT">% of pay</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">{l.type === "PERCENT" ? "Percent" : "Amount (₹)"}</Label>
                  <Input type="number" min={0} value={l.value} disabled={ro}
                    onChange={(e) => setLine(i, { value: Number(e.target.value) })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Applies to basis</Label>
                  <select className={select} value={l.basis} disabled={ro} onChange={(e) => setLine(i, { basis: e.target.value as any })}>
                    <option value="">Any</option>
                    <option value="MONTHLY">Monthly only</option>
                    <option value="HOURLY">Hourly only</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <Label className="text-xs">Employees — {l.employeeIds.length === 0 ? "everyone" : `${l.employeeIds.length} selected`}</Label>
                {l.employeeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {l.employeeIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {empName(id)}
                        {canEdit && (
                          <button type="button" aria-label={`Remove ${empName(id)}`}
                            onClick={() => setLine(i, { employeeIds: l.employeeIds.filter((x) => x !== id) })}>
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {canEdit && (
                  <SearchableSelect
                    value="" placeholder="Limit to specific employees… (add one)"
                    options={empOptions.filter((o) => !l.employeeIds.includes(Number(o.value)))}
                    onChange={(v) => v && setLine(i, { employeeIds: [...l.employeeIds, Number(v)] })}
                  />
                )}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Switch checked={l.enabled} disabled={ro} onCheckedChange={(v) => setLine(i, { enabled: v })} /> Enabled
                </label>
                {canEdit && (
                  <Button size="sm" variant="ghost" className="text-rose-700"
                    onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="mt-3" onClick={addLine}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add default line
          </Button>
        )}
        <p className="mt-3 text-xs text-slate-500">
          "% of pay" is taken on regular + overtime pay.
        </p>
      </Card>

      {/* ---------- 3. template ---------- */}
      <Card title="Printed payslip" sub="How the payslip looks when HR prints it and when employees download it.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Title" value={t.title} onChange={(v) => setTpl({ title: v })} disabled={ro} maxLength={60} />
              <div className="space-y-1">
                <Label className="text-sm">Accent colour</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={t.accentColor} disabled={ro} aria-label="Accent colour"
                    onChange={(e) => setTpl({ accentColor: e.target.value })}
                    className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-1" />
                  <Input value={t.accentColor} disabled={ro} onChange={(e) => setTpl({ accentColor: e.target.value })} />
                </div>
              </div>
            </div>
            <TextField label="Registration / GST line" value={t.registrationNo} onChange={(v) => setTpl({ registrationNo: v })}
              hint="Shown under the company address, e.g. GSTIN 33ABCDE1234F1Z5." disabled={ro} maxLength={120} />
            <TextField label="Footer note" value={t.footerNote} onChange={(v) => setTpl({ footerNote: v })} disabled={ro} maxLength={300} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Left signature label" value={t.employeeSignLabel} onChange={(v) => setTpl({ employeeSignLabel: v })} disabled={ro || !t.showSignatures} maxLength={40} />
              <TextField label="Right signature label" value={t.companySignLabel} onChange={(v) => setTpl({ companySignLabel: v })} disabled={ro || !t.showSignatures} maxLength={40} />
            </div>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
              <Toggle label="Employee details" hint="Designation, department, joining date, UAN, PF, ESI" checked={t.showEmployeeDetails} onChange={(v) => setTpl({ showEmployeeDetails: v })} disabled={ro} />
              <Toggle label="Bank account (last 4 digits)" checked={t.showBankAccount} onChange={(v) => setTpl({ showBankAccount: v })} disabled={ro || !t.showEmployeeDetails} />
              <Toggle label="Attendance & hours summary" checked={t.showAttendance} onChange={(v) => setTpl({ showAttendance: v })} disabled={ro} />
              <Toggle label="Net pay in words" checked={t.showAmountInWords} onChange={(v) => setTpl({ showAmountInWords: v })} disabled={ro} />
              <Toggle label="Status line (Pending / Paid on…)" checked={t.showStatusLine} onChange={(v) => setTpl({ showStatusLine: v })} disabled={ro} />
              <Toggle label="Signature lines" checked={t.showSignatures} onChange={(v) => setTpl({ showSignatures: v })} disabled={ro} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-sm">Live preview</Label>
            <iframe title="Payslip template preview" srcDoc={html} className="w-full rounded-lg border bg-white" style={{ height: 620 }} />
          </div>
        </div>
      </Card>

      {/* ---------- 4. visibility ---------- */}
      <Card title="Employee access" sub="When an employee can see their payslip in the portal.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-sm">Show payslip once it is</Label>
            <select className={select} value={form.visibility.releaseOn} disabled={ro}
              onChange={(e) => setVis({ releaseOn: e.target.value as any })}>
              <option value="GENERATED">Generated (draft, marked "not final")</option>
              <option value="APPROVED">Approved by HR</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>
        <Toggle label="Notify the employee when it appears" hint="A “Payslip ready” notification at that stage." checked={form.visibility.notifyEmployee}
          onChange={(v) => setVis({ notifyEmployee: v })} disabled={ro} />
      </Card>

      {canEdit && (
        <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-b-xl">
          <Button variant="forest" disabled={!dirty || saving} onClick={save}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save payslip settings"}
          </Button>
        </div>
      )}
    </div>
  );
}
