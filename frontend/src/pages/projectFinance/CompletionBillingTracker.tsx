import { useEffect, useState } from "react";
import {
  Loader2, Zap, CheckCircle2, Clock, CircleDollarSign, Lock, ChevronRight, PartyPopper,
} from "lucide-react";
import { financeApi } from "@/api/financeApi";
import type { BillingProgress, BillingStage } from "@/types/finance";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const inr = (n?: number | null) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const prettyStage = (s: string) =>
  s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Status pill for a milestone. */
function stageBadge(status: string): { text: string; cls: string } {
  switch (status) {
    case "PAID": return { text: "Paid", cls: "bg-emerald-100 text-emerald-700" };
    case "PARTIAL": return { text: "Partial", cls: "bg-amber-100 text-amber-700" };
    case "INVOICED": return { text: "Due", cls: "bg-blue-100 text-blue-700" };
    case "OVERDUE": return { text: "Overdue", cls: "bg-red-100 text-red-600" };
    default: return { text: "Pending", cls: "bg-slate-100 text-slate-500" };
  }
}

/**
 * Combined completion + billing tracker for a project. Shows the auto-calculated work % and the
 * collected-payment %, plus a milestone timeline: as work crosses each stage's trigger the stage
 * auto-bills (invoice raised, marked Due). Money is never auto-collected — a human still marks paid.
 */
export default function CompletionBillingTracker({ project, onChanged, refreshSignal }: { project: any; onChanged?: () => void; refreshSignal?: number }) {
  const { hasAuthority } = useAuth();
  const canWrite = hasAuthority("FINANCE_WRITE");
  const projectId = project?.id;

  const [data, setData] = useState<BillingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    financeApi.getBillingProgress(projectId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [projectId, refreshSignal]);

  const toggleAuto = (enabled: boolean) => {
    if (!data) return;
    setData({ ...data, autoBillingEnabled: enabled }); // optimistic
    setBusy(true);
    financeApi.setAutoBilling(projectId, enabled)
      .then(() => { load(); onChanged?.(); })
      .catch(() => load())
      .finally(() => setBusy(false));
  };

  const generatePlan = () => {
    setBusy(true);
    financeApi.generateDefaultSchedule(projectId)
      .then(() => { load(); onChanged?.(); })
      .catch((e) => alert(e?.response?.data?.message || "Could not create the payment plan."))
      .finally(() => setBusy(false));
  };

  if (loading) {
    return (
      <div className="flex justify-center rounded-2xl border border-slate-100 bg-white py-8 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  // No payment plan yet — offer to seed the standard milestone plan.
  if (!data.hasSchedule) {
    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <CircleDollarSign className="h-5 w-5 text-blue-600" /> Completion &amp; Billing
        </div>
        <p className="mt-2 text-sm text-slate-500">
          No payment milestone plan yet. Add one so invoices raise automatically as work progresses
          (e.g. 50%, 75%, 90%, on completion).
        </p>
        {canWrite && (
          <Button className="mt-4" onClick={generatePlan} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Create standard plan
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <CircleDollarSign className="h-5 w-5 text-blue-600" /> Completion &amp; Billing
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Zap className={`h-4 w-4 ${data.autoBillingEnabled ? "text-amber-500" : "text-slate-300"}`} />
          <span className="font-medium">Auto-bill on progress</span>
          <Switch checked={data.autoBillingEnabled} disabled={!canWrite || busy}
            onCheckedChange={(v) => toggleAuto(!!v)} />
        </label>
      </div>

      {/* Two progress bars: work vs payments */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Bar label="Work completed" percent={data.workPercent} tone="blue"
          caption={`${data.workPercent}% of tasks done`} />
        <Bar label="Payments collected" percent={data.paymentPercent} tone="emerald"
          caption={`${inr(data.collectedTotal)} of ${inr(data.scheduledTotal)}`} />
      </div>

      {data.fullySettled && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <PartyPopper className="h-4 w-4" /> Fully completed and fully paid.
        </div>
      )}

      {/* Milestone timeline */}
      <div className="mt-6">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment milestones</h4>
        <ol className="relative space-y-1 border-l border-slate-200 pl-5">
          {data.stages.map((s) => <MilestoneRow key={s.id} s={s} workPercent={data.workPercent} />)}
        </ol>
      </div>
    </section>
  );
}

function MilestoneRow({ s, workPercent }: { s: BillingStage; workPercent: number }) {
  const badge = stageBadge(s.status);
  const isPaid = s.status === "PAID";
  // A progress-driven stage that work hasn't reached yet is "locked".
  const locked = s.progressDriven && !s.reached && s.status === "PENDING";

  const dotCls = isPaid
    ? "bg-emerald-500 border-emerald-500"
    : s.status === "PENDING"
      ? (locked ? "bg-white border-slate-300" : "bg-blue-500 border-blue-500")
      : "bg-blue-500 border-blue-500";

  return (
    <li className="relative py-2">
      <span className={`absolute -left-[27px] top-3.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${dotCls}`}>
        {isPaid && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
      </span>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{prettyStage(s.stage)}</span>
            {s.progressDriven ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                s.reached ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
                {locked ? <Lock className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                at {Number(s.triggerPercentage)}%
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">manual</span>
            )}
            {s.autoTriggered && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                <Zap className="h-2.5 w-2.5" /> auto
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {s.invoice ? `Invoice ${s.invoice.invoiceNumber}` : locked ? `Unlocks at ${Number(s.triggerPercentage)}% work` : "Not invoiced"}
            {locked && workPercent > 0 ? ` · ${Math.max(0, Number(s.triggerPercentage) - workPercent)}% to go` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{inr(s.amount)}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
            {s.status === "PENDING" && !locked && <Clock className="h-3 w-3" />}
            {badge.text}
          </span>
        </div>
      </div>
    </li>
  );
}

function Bar({ label, percent, caption, tone }: { label: string; percent: number; caption: string; tone: "blue" | "emerald" }) {
  const barCls = tone === "blue" ? "bg-blue-500" : "bg-emerald-500";
  const pctCls = tone === "blue" ? "text-blue-600" : "text-emerald-600";
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`text-lg font-black ${pctCls}`}>{percent}%</span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{caption}</p>
    </div>
  );
}
