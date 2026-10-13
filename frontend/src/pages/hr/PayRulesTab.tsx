import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { payrollApi, type PayRules } from "@/api/payrollApi";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Form = Record<keyof PayRules, string>;

const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;
const toForm = (r: PayRules): Form =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(Number(v))])) as Form;

function Field({
  label, hint, value, onChange, prefix, disabled,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; prefix?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{prefix}</span>}
        <Input
          type="number" inputMode="decimal" min={0} value={value} disabled={disabled}
          className={prefix ? "pl-7" : ""} onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mb-4 text-sm text-slate-500">{sub}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Pay rules: the wage basics every employee falls back to, and the automatic incentives added to
 * each payslip when it is generated. An amount of 0 switches that incentive off. Changes apply to
 * payslips generated from now on — existing ones stay as they are (regenerate to pick them up).
 */
export default function PayRulesTab({ canEdit }: { canEdit: boolean }) {
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    payrollApi.payRules()
      .then((r) => { const f = toForm(r); setForm(f); setSaved(f); })
      .catch((e) => toast.error(errMsg(e, "Could not load pay rules")));
  }, []);

  if (!form) return <Skeleton className="h-64 w-full" />;

  const set = (k: keyof PayRules) => (v: string) => setForm({ ...form, [k]: v });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function save() {
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(form!).map(([k, v]) => [k, Number(v || 0)]));
      const r = await payrollApi.savePayRules(body);
      const f = toForm(r);
      setForm(f); setSaved(f);
      toast.success("Pay rules saved");
    } catch (e) {
      toast.error(errMsg(e, "Could not save pay rules"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Section
        title="Wage basics"
        sub="Used when an employee has no hours or working days of their own. Hourly and monthly pay are both worked out from these."
      >
        <Field label="Standard hours per day" hint="Hours beyond this are overtime." value={form.dailyHours} onChange={set("dailyHours")} disabled={!canEdit} />
        <Field label="Paid working days per month" hint="Monthly salary ÷ (hours × days) gives the hourly rate." value={form.workingDays} onChange={set("workingDays")} disabled={!canEdit} />
      </Section>

      <Section title="Work incentives" sub="Added automatically as a line on the payslip. 0 = off.">
        <Field label="Per project completed" prefix="₹" hint="Paid once to the project manager and assistant manager when a project completes in the month." value={form.projectIncentive} onChange={set("projectIncentive")} disabled={!canEdit} />
        <Field label="Per qualified lead" prefix="₹" hint="Leads the employee collected that moved past New and aren't Lost. Paid once per lead." value={form.leadReward} onChange={set("leadReward")} disabled={!canEdit} />
        <Field label="Per Google review" prefix="₹" hint="Reward when HR pays a verified QR review. Added to the payslip as a Google reviews line." value={form.reviewReward} onChange={set("reviewReward")} disabled={!canEdit} />
      </Section>

      <Section title="Attendance & performance bonus" sub="One flat bonus per month when the employee reaches the minimum. 0 = off.">
        <Field label="Attendance bonus" prefix="₹" value={form.attendanceBonus} onChange={set("attendanceBonus")} disabled={!canEdit} />
        <Field label="Minimum attendance %" hint="Present = 1 day, half day = ½, absent = 0; approved leave is ignored." value={form.attendanceMinPercent} onChange={set("attendanceMinPercent")} disabled={!canEdit} />
        <Field label="Performance bonus" prefix="₹" value={form.performanceBonus} onChange={set("performanceBonus")} disabled={!canEdit} />
        <Field label="Minimum performance score" hint="Out of 100 — the auto score from attendance, tasks and reviews." value={form.performanceMinScore} onChange={set("performanceMinScore")} disabled={!canEdit} />
      </Section>

      <p className="text-xs text-slate-500">
        Only employees marked bonus-eligible receive the project, attendance and performance incentives.
        Changes apply to payslips generated from now on; to update one already made, delete or regenerate it.
      </p>

      {canEdit && (
        <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-b-xl">
          <Button variant="forest" disabled={!dirty || saving} onClick={save}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save pay rules"}
          </Button>
        </div>
      )}
    </div>
  );
}
