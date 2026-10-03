import { useEffect, useState } from "react";
import {
  Loader2, Zap, CheckCircle2, Clock, CircleDollarSign, Lock, ChevronRight, PartyPopper, FilePlus2,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
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
    case "INVOICED": return { text: "Due", cls: "bg-amber-100 text-amber-800" };
    case "OVERDUE": return { text: "Overdue", cls: "bg-red-100 text-red-600" };
    default: return { text: "Pending", cls: "bg-slate-100 text-slate-500" };
  }
}

/**
 * Combined completion + billing tracker for a project. Shows the auto-calculated work % and the
 * collected-payment %, plus a milestone timeline: as work crosses each stage's trigger the stage
 * auto-bills (invoice raised, marked Due). Money is never auto-collected — a human still marks paid.
 */
export default function CompletionBillingTracker({ project, onChanged, refreshSignal, compact }: { project: any; onChanged?: () => void; refreshSignal?: number; compact?: boolean }) {
  const { hasAuthority } = useAuth();
  const canWrite = hasAuthority("FINANCE_WRITE");
  const projectId = project?.id;

  const [data, setData] = useState<BillingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [raisingId, setRaisingId] = useState<number | null>(null);

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
      .catch((e) => toast.error(e?.response?.data?.message || "Could not create the payment plan."))
      .finally(() => setBusy(false));
  };

  // Manually raise the invoice for a milestone now (the same invoice auto-billing would create when
  // work crosses the trigger) — for stages that are due but not yet invoiced, or when auto-bill is off.
  const raiseInvoice = (scheduleId: number) => {
    setRaisingId(scheduleId);
    financeApi.generateStageInvoice(scheduleId)
      .then(() => { load(); onChanged?.(); toast.success("Invoice raised for this milestone."); })
      .catch((e) => toast.error(e?.response?.data?.message || "Could not raise the invoice."))
      .finally(() => setRaisingId(null));
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
      <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><CircleDollarSign className="h-5 w-5" /></span>
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-900">No payment schedule yet</div>
          <p className="text-xs text-slate-500">Add milestones (e.g. advance, 50%, 90%, completion) so invoices raise automatically as work progresses.</p>
        </div>
        {canWrite && (
          <Button onClick={generatePlan} disabled={busy} className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white shrink-0">
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />} Create standard plan
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] @container">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-700" /> Payment Schedule</h3>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <Zap className={`h-4 w-4 ${data.autoBillingEnabled ? "text-amber-500" : "text-slate-300"}`} />
          <span className="font-semibold">Auto-bill on progress</span>
          <Switch checked={data.autoBillingEnabled} disabled={!canWrite || busy} onCheckedChange={(v) => toggleAuto(!!v)} />
        </label>
      </div>

      <div className={compact ? "p-3 space-y-3" : "p-4 space-y-4"}>
        {/* Work vs money, side by side */}
        <div className={`grid grid-cols-1 @xl:grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
          <Bar label="Work completed" percent={data.workPercent} tone="work" caption={`${data.workPercent}% of the work done`} compact={compact} />
          <Bar label="Payments collected" percent={data.paymentPercent} tone="money" caption={`${inr(data.collectedTotal)} of ${inr(data.scheduledTotal)}`} compact={compact} />
        </div>

        {data.fullySettled && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
            <PartyPopper className="h-4 w-4" /> Fully completed and fully paid.
          </div>
        )}

        {/* Milestone stepper — a row of steps on wide screens, a list on phones */}
        <ol className={`grid grid-cols-1 gap-2.5 ${compact
          ? (data.stages.length >= 4 ? "!grid-cols-2 @3xl:!grid-cols-4" : data.stages.length === 3 ? "!grid-cols-2 @md:!grid-cols-3" : "!grid-cols-2")
          : (data.stages.length >= 4 ? "@3xl:grid-cols-2 @6xl:grid-cols-4" : data.stages.length === 3 ? "@4xl:grid-cols-3" : "@2xl:grid-cols-2")}`}>
          {data.stages.map((s, i) => (
            <MilestoneStep key={s.id} s={s} index={i} workPercent={data.workPercent} compact={compact}
              canWrite={canWrite} raising={raisingId === s.id} onRaise={() => raiseInvoice(s.id)} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function MilestoneStep({ s, index, workPercent, canWrite, raising, onRaise, compact }: { s: BillingStage; index: number; workPercent: number; canWrite: boolean; raising: boolean; onRaise: () => void; compact?: boolean }) {
  const badge = stageBadge(s.status);
  const isPaid = s.status === "PAID";
  // A progress-driven stage that work hasn't reached yet is "locked" (upcoming).
  const locked = s.progressDriven && !s.reached && s.status === "PENDING";
  const due = !isPaid && !locked;
  // Not yet invoiced and there's an amount to bill — a human can raise it now.
  const canRaise = canWrite && !s.invoice && s.status === "PENDING" && Number(s.amount) > 0;
  const toGo = locked ? Math.max(0, Number(s.triggerPercentage) - workPercent) : 0;

  const box = isPaid ? "border-emerald-200 bg-emerald-50/50" : s.status === "OVERDUE" ? "border-rose-200 bg-rose-50/40" : due ? "border-amber-200 bg-amber-50/50" : "border-slate-100 bg-white";
  const circle = isPaid ? "bg-emerald-700 text-white" : s.status === "OVERDUE" ? "bg-rose-600 text-white" : due ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500";

  return (
    <li className={`rounded-2xl border transition-shadow hover:shadow-md ${compact ? "p-2.5" : "p-3"} ${box}`}>
      <div className="flex items-start gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${circle}`}>
          {isPaid ? <CheckCircle2 className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-bold text-slate-900 leading-tight">{prettyStage(s.stage)}</span>
            <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${locked ? "bg-slate-100 text-slate-500" : badge.cls}`}>
              {s.status === "PENDING" && !locked && <Clock className="h-3 w-3" />}
              {locked ? "Upcoming" : badge.text}
            </span>
          </div>
          <div className={`mt-1 font-bold text-slate-900 ${compact ? "text-base" : "text-lg"}`}>{inr(s.amount)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {s.progressDriven ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${s.reached ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {locked ? <Lock className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />} at {Number(s.triggerPercentage)}% work
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">manual</span>
            )}
            {s.autoTriggered && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"><Zap className="h-2.5 w-2.5" /> auto</span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {s.invoice ? <>Invoice <span className="font-semibold text-slate-700">{s.invoice.invoiceNumber}</span></> : locked ? `${toGo}% more work to unlock` : "Not invoiced yet"}
          </p>
          {canRaise && (
            <button type="button" onClick={onRaise} disabled={raising}
              title={locked ? "Raise this invoice now (before work reaches the trigger)" : "Raise this invoice now"}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50">
              {raising ? <Loader2 className="h-3 w-3 animate-spin" /> : <FilePlus2 className="h-3 w-3" />} Raise invoice
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function Bar({ label, percent, caption, tone, compact }: { label: string; percent: number; caption: string; tone: "work" | "money"; compact?: boolean }) {
  const barCls = tone === "work" ? "bg-sky-600" : "bg-emerald-600";
  if (compact) {
    return (
      <div className="rounded-xl bg-slate-50/70 px-3 py-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-500">{label}</span>
          <span className="text-slate-400">{caption} · <span className="font-bold text-slate-800">{percent}%</span></span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className="text-base font-bold text-slate-900">{percent}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">{caption}</p>
    </div>
  );
}
