import { useEffect, useState } from "react";
import { CheckCircle2, CircleDollarSign, FilePlus2, Loader2, Lock, PartyPopper } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { financeApi } from "@/api/financeApi";
import type { BillingProgress, BillingStage } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { MoneySection } from "./MoneySection";

const inr = (n?: number | null) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const prettyStage = (s: string) =>
  s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

type StageState = "paid" | "partial" | "overdue" | "invoiced" | "ready" | "upcoming";

/** Where a milestone stands, from the user's point of view: billed, ready to bill, or not yet. */
function stageState(s: BillingStage): StageState {
  switch (s.status) {
    case "PAID": return "paid";
    case "PARTIAL": return "partial";
    case "OVERDUE": return "overdue";
    case "INVOICED": return "invoiced";
    default: return s.progressDriven && !s.reached ? "upcoming" : "ready";
  }
}

const STATE_LABEL: Record<StageState, { text: string; cls: string }> = {
  paid: { text: "Paid", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partial: { text: "Part paid", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  overdue: { text: "Overdue", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  invoiced: { text: "Invoiced", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  ready: { text: "Ready to bill", cls: "bg-amber-100 text-amber-900 ring-amber-300" },
  upcoming: { text: "Upcoming", cls: "bg-slate-50 text-slate-500 ring-slate-200" },
};

/**
 * The project's payment plan against work done. Each milestone is billed by hand: once work reaches a
 * stage's trigger (or straight away for a manual stage) it shows as "Ready to bill" with a Raise
 * invoice button. Nothing is invoiced or collected automatically.
 */
export default function CompletionBillingTracker({ project, onChanged, refreshSignal }: {
  project: any; onChanged?: () => void; refreshSignal?: number;
  /** Kept for callers; the schedule has a single compact layout now. */
  compact?: boolean;
}) {
  const { hasAuthority } = useAuth();
  const canWrite = hasAuthority("FINANCE_WRITE");
  const projectId = project?.id;
  const hasCustomer = !!project?.customer?.id;

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

  const generatePlan = () => {
    setBusy(true);
    financeApi.generateDefaultSchedule(projectId)
      .then(() => { load(); onChanged?.(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Could not create the payment plan."))
      .finally(() => setBusy(false));
  };

  const raiseInvoice = (scheduleId: number) => {
    setRaisingId(scheduleId);
    financeApi.generateStageInvoice(scheduleId)
      .then(() => { load(); onChanged?.(); toast.success("Invoice raised for this milestone."); })
      .catch((e) => toast.error(e?.response?.data?.message || "Could not raise the invoice."))
      .finally(() => setRaisingId(null));
  };

  if (loading && !data) {
    return (
      <MoneySection icon={CircleDollarSign} title="Payment schedule">
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-full" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      </MoneySection>
    );
  }
  if (!data) return null;

  if (!data.hasSchedule) {
    return (
      <MoneySection icon={CircleDollarSign} title="Payment schedule">
        <div className="flex flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">No payment schedule yet</p>
            <p className="mt-0.5 max-w-[60ch] text-sm text-slate-500">
              Split the contract into milestones (advance, mid-way, completion) so you can see what to bill as the work moves.
            </p>
          </div>
          {canWrite && (
            <Button variant="forest" onClick={generatePlan} disabled={busy} className="shrink-0 active:scale-[0.98]">
              {busy ? <Loader2 className="animate-spin" /> : <CircleDollarSign />} Create standard plan
            </Button>
          )}
        </div>
      </MoneySection>
    );
  }

  const ready = data.stages.filter((s) => stageState(s) === "ready");
  const readyTotal = ready.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  return (
    <MoneySection
      icon={CircleDollarSign}
      title="Payment schedule"
      subtitle={`${inr(data.collectedTotal)} collected of ${inr(data.scheduledTotal)} scheduled`}
    >
      {/* Work vs money — the gap between the two bars is what's left to bill or collect. */}
      <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-3 @lg:grid-cols-2 @lg:gap-6">
        <Meter label="Work done" percent={data.workPercent} barCls="bg-sky-600" />
        <Meter label="Payment collected" percent={data.paymentPercent} barCls="bg-emerald-600" />
      </div>

      {data.fullySettled ? (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-emerald-50/60 px-4 py-2.5 text-sm font-medium text-emerald-800">
          <PartyPopper className="h-4 w-4" /> Work complete and fully paid.
        </div>
      ) : ready.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-200/70 bg-amber-50/70 px-4 py-2.5 text-sm text-amber-900">
          <FilePlus2 className="h-4 w-4 shrink-0 text-amber-700" />
          <span className="font-semibold">
            {ready.length === 1 ? "1 milestone is" : `${ready.length} milestones are`} ready to bill
          </span>
          <span className="tabular-nums text-amber-800/80">· {inr(readyTotal)}</span>
          {!hasCustomer && <span className="text-amber-800/80">· link a customer to raise invoices</span>}
        </div>
      )}

      <ol className="divide-y divide-slate-100">
        {data.stages.map((s, i) => (
          <MilestoneRow
            key={s.id}
            s={s}
            index={i}
            workPercent={data.workPercent}
            canRaise={canWrite && hasCustomer && !s.invoice && s.status === "PENDING" && Number(s.amount) > 0}
            raising={raisingId === s.id}
            onRaise={() => raiseInvoice(s.id)}
          />
        ))}
      </ol>
    </MoneySection>
  );
}

function MilestoneRow({ s, index, workPercent, canRaise, raising, onRaise }: {
  s: BillingStage; index: number; workPercent: number; canRaise: boolean; raising: boolean; onRaise: () => void;
}) {
  const state = stageState(s);
  const label = STATE_LABEL[state];
  const toGo = Math.max(0, Number(s.triggerPercentage ?? 0) - workPercent);

  const marker = state === "paid"
    ? "bg-emerald-700 text-white"
    : state === "ready"
      ? "bg-amber-500 text-white"
      : state === "overdue"
        ? "bg-rose-600 text-white"
        : state === "upcoming"
          ? "bg-slate-100 text-slate-400"
          : "bg-sky-100 text-sky-700";

  const caption = s.invoice
    ? <>Invoice <span className="font-medium text-slate-700">{s.invoice.invoiceNumber}</span>
        {Number(s.invoice.balanceDue || 0) > 0 && state !== "paid" && <> · {inr(s.invoice.balanceDue)} to collect</>}</>
    : s.progressDriven
      ? state === "upcoming" ? `Bills at ${Number(s.triggerPercentage)}% work · ${toGo}% to go` : `Work reached ${Number(s.triggerPercentage)}%`
      : "Bill whenever agreed";

  return (
    <li className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 @xl:grid-cols-[auto_minmax(0,1fr)_7.5rem_9.5rem] ${state === "ready" ? "bg-amber-50/40" : ""}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${marker}`}>
        {state === "paid" ? <CheckCircle2 className="h-4 w-4" /> : state === "upcoming" ? <Lock className="h-3.5 w-3.5" /> : index + 1}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{prettyStage(s.stage)}</span>
          {s.percentage != null && <span className="text-xs tabular-nums text-slate-400">{Number(s.percentage)}%</span>}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{caption}</p>
      </div>

      <span className="text-right text-sm font-semibold tabular-nums text-slate-900 @xl:text-base">{inr(s.amount)}</span>

      <div className="col-span-3 flex items-center justify-end gap-2 @xl:col-span-1">
        {canRaise ? (
          state === "ready" ? (
            <Button size="sm" onClick={onRaise} disabled={raising} className="w-full @xl:w-auto active:scale-[0.98]">
              {raising ? <Loader2 className="animate-spin" /> : <FilePlus2 />} Raise invoice
            </Button>
          ) : (
            <button type="button" onClick={onRaise} disabled={raising}
              title="Raise this invoice before work reaches the trigger"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50">
              {raising ? <Loader2 className="h-3 w-3 animate-spin" /> : <FilePlus2 className="h-3 w-3" />} Bill early
            </button>
          )
        ) : null}
        {!(canRaise && state === "ready") && (
          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${label.cls}`}>
            {label.text}
          </span>
        )}
      </div>
    </li>
  );
}

function Meter({ label, percent, barCls }: { label: string; percent: number; barCls: string }) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-500">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">{percent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
