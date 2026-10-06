import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Check, CircleDashed, ClipboardList, Pencil, Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lead, UserSummary } from "../constants";
import { formatINR } from "../constants";
import type { JourneyStep, JourneyStepId, LeadJourney } from "../journey";
import QuoteWorkspace from "../quote/QuoteWorkspace";
import ProjectsTab from "./ProjectsTab";

/**
 * One guided view of the whole pre-sales pipeline: Requirement → Measurement & Quotation → Convert.
 * A sticky progress rail on top shows where the deal stands and carries the next action; below it every
 * stage is always open (no collapsing) — site visit, measurement, BOQ pricing and the quotation all
 * live in one combined workspace because they only exist to produce the quote.
 */
export default function SalesJourneyTab({
  leadId,
  lead,
  journey,
  focusStep,
  onChanged,
  onEditRequirement,
  onConvert,
}: {
  leadId: string;
  lead: Lead;
  users: UserSummary[];
  journey: LeadJourney;
  /** Bumped by the parent to scroll a stage into view (e.g. from the Next-Step banner). */
  focusStep?: { id: JourneyStepId; nonce: number } | null;
  onChanged: () => void;
  onEditRequirement: () => void;
  onConvert: () => void;
}) {
  const sectionRefs = useRef<Partial<Record<JourneyStepId, HTMLElement | null>>>({});
  const [inView, setInView] = useState<JourneyStepId | null>(null);

  // Stage statuses come from fetched records; until the first fetch settles they'd read "upcoming".
  // Later reloads keep the last known statuses on screen instead of flashing skeletons.
  const settled = useRef(false);
  if (!journey.loading) settled.current = true;
  const resolving = !settled.current;

  const scrollTo = (id: JourneyStepId) => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    sectionRefs.current[id]?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  // Respond to the banner: scroll the requested stage into view.
  useEffect(() => {
    if (focusStep) scrollTo(focusStep.id);
  }, [focusStep]);

  // Track which stage is on screen so the rail can mark it — the quote sheet is long.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setInView((visible.target as HTMLElement).dataset.step as JourneyStepId);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const doneCount = journey.steps.filter((s) => s.status === "done").length;
  const next = journey.currentStep;

  const runNext = () => {
    if (!next) return;
    if (next.id === "requirement") onEditRequirement();
    else if (next.id === "convert") onConvert();
    else scrollTo(next.id);
  };

  return (
    <div className="space-y-8">
      {/* Progress rail — sticky on desktop so the deal's state and next action stay in reach. */}
      <nav
        aria-label="Sales journey progress"
        className="md:sticky md:top-0 z-10 -mx-1 px-1 pt-1 pb-3 bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur border-b"
      >
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <p className="text-xs font-medium text-muted-foreground">
                {resolving ? "Checking progress" : journey.converted
                  ? "Deal won and converted"
                  : journey.closed
                    ? `Journey paused — lead is ${lead.status}`
                    : `Stage ${Math.min(doneCount + 1, journey.steps.length)} of ${journey.steps.length}`}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {resolving ? "" : `${doneCount}/${journey.steps.length} complete`}
              </p>
            </div>
            <ol className="grid grid-cols-3 gap-2 sm:gap-3">
              {journey.steps.map((step, index) => (
                <RailStep
                  key={step.id}
                  step={step}
                  index={index}
                  resolving={resolving}
                  active={inView === step.id}
                  onSelect={() => scrollTo(step.id)}
                />
              ))}
            </ol>
          </div>
          {!resolving && next && !journey.closed && (
            <Button onClick={runNext} className="shrink-0 w-full md:w-auto active:scale-[0.98] transition-transform">
              {next.actionLabel} <ArrowRight />
            </Button>
          )}
        </div>
      </nav>

      {journey.steps.map((step, index) => (
        <section
          key={step.id}
          data-step={step.id}
          ref={(el) => { sectionRefs.current[step.id] = el; }}
          aria-labelledby={`journey-${step.id}`}
          className="scroll-mt-4 md:scroll-mt-32"
        >
          <StageHeader
            step={step}
            index={index}
            resolving={resolving}
            action={step.id === "requirement" && hasRequirementData(lead) ? (
              <Button size="sm" variant="outline" onClick={onEditRequirement}>
                <Pencil /> Edit
              </Button>
            ) : null}
          />
          <div className={`mt-4 ${step.id === "quote" ? "" : "sm:pl-12"}`}>
            {renderStage(step.id)}
          </div>
        </section>
      ))}
    </div>
  );

  function renderStage(id: JourneyStepId) {
    switch (id) {
      case "requirement":
        return <RequirementSummary lead={lead} onEdit={onEditRequirement} />;
      case "quote":
        return <QuoteWorkspace leadId={leadId} onChanged={() => { onChanged(); }} />;
      case "convert":
        return journey.converted
          ? <ProjectsTab leadId={leadId} />
          : <ConvertPanel steps={journey.steps} closed={journey.closed} onConvert={onConvert} />;
    }
  }
}

/* ─── Progress rail ───────────────────────────────────────────────────────── */

function RailStep({ step, index, resolving, active, onSelect }: {
  step: JourneyStep; index: number; resolving: boolean; active: boolean; onSelect: () => void;
}) {
  const bar = step.status === "done"
    ? "bg-primary"
    : step.status === "current"
      ? "bg-gradient-to-r from-gold from-40% to-border to-40%"
      : "bg-border";
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={step.status === "current" ? "step" : undefined}
        className={`group w-full text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active ? "" : "opacity-90 hover:opacity-100"}`}
      >
        {resolving
          ? <Skeleton className="h-1.5 w-full rounded-full" />
          : <span className={`block h-1.5 w-full rounded-full transition-colors duration-300 ${bar}`} />}
        <span className="mt-2 flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">0{index + 1}</span>
          <span className={`truncate text-xs sm:text-sm font-medium ${active ? "text-foreground" : "text-foreground/80"} group-hover:text-foreground`}>
            {step.label}
          </span>
        </span>
        <span className="mt-0.5 hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          {resolving ? <Skeleton className="h-3 w-16" /> : <StatusText status={step.status} />}
        </span>
      </button>
    </li>
  );
}

function StatusText({ status }: { status: JourneyStep["status"] }) {
  if (status === "done") return <><Check className="h-3.5 w-3.5 text-primary" /> Done</>;
  if (status === "current") {
    return (
      <>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
        </span>
        In progress
      </>
    );
  }
  return <><CircleDashed className="h-3.5 w-3.5" /> Upcoming</>;
}

/* ─── Stage section header ────────────────────────────────────────────────── */

function StageHeader({ step, index, resolving, action }: {
  step: JourneyStep; index: number; resolving: boolean; action?: React.ReactNode;
}) {
  const current = step.status === "current";
  return (
    <header className="flex items-start gap-3 sm:gap-4">
      <StageMarker status={resolving ? "upcoming" : step.status} index={index} />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 id={`journey-${step.id}`} className="text-base font-semibold tracking-tight text-foreground">
            {step.label}
          </h2>
          {!resolving && <StatusChip status={step.status} />}
        </div>
        {resolving
          ? <Skeleton className="mt-1.5 h-3.5 w-56" />
          : <p className={`text-sm mt-0.5 ${current ? "text-foreground/80" : "text-muted-foreground"}`}>{step.summary}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

function StageMarker({ status, index }: { status: JourneyStep["status"]; index: number }) {
  if (status === "done") {
    return (
      <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </div>
    );
  }
  const cls = status === "current"
    ? "border-gold text-foreground bg-gold/10 ring-4 ring-gold/10"
    : "border-border text-muted-foreground bg-card";
  return (
    <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold tabular-nums shrink-0 ${cls}`}>
      {index + 1}
    </div>
  );
}

function StatusChip({ status }: { status: JourneyStep["status"] }) {
  const base = "text-[11px] font-medium px-2 py-0.5 rounded-full border";
  if (status === "done") return <span className={`${base} border-primary/20 bg-primary/10 text-primary`}>Done</span>;
  if (status === "current") return <span className={`${base} border-gold/30 bg-gold/10 text-foreground`}>In progress</span>;
  return <span className={`${base} border-border bg-muted text-muted-foreground`}>Upcoming</span>;
}

/* ─── Stage 1: requirement ────────────────────────────────────────────────── */

const SCOPE_FIELDS: Array<[string, string]> = [
  ["Modular Kitchen", "reqKitchen"], ["Wardrobe", "reqWardrobe"], ["TV Unit", "reqTvUnit"],
  ["False Ceiling", "reqFalseCeiling"], ["Painting", "reqPainting"], ["Flooring", "reqFlooring"],
  ["Electrical", "reqElectrical"], ["Plumbing", "reqPlumbing"], ["Wood Finish", "reqWoodFinish"],
];

type FieldRow = readonly [string, React.ReactNode];

function requirementGroups(lead: Lead): Array<{ title: string; fields: FieldRow[] }> {
  const l = lead as any;
  const keep = (rows: FieldRow[]) => rows.filter(([, v]) => v != null && v !== "");
  return [
    {
      title: "Property",
      fields: keep([
        ["Category", l.requirementCategory], ["Property type", l.propertyType],
        ["Construction stage", l.currentConstructionStage], ["Floors", l.floorCount],
        ["Area", l.areaSqft ? `${l.areaSqft} sq.ft` : null], ["Rooms", l.roomsRequired],
      ]),
    },
    {
      title: "Preferences",
      fields: keep([
        ["Design style", l.preferredDesignStyle], ["Material", l.preferredMaterial],
        ["Colour theme", l.preferredColorTheme],
      ]),
    },
    {
      title: "Commercials",
      fields: keep([
        ["Budget range", budgetRange(lead)], ["Payment", l.paymentPreference],
        ["Target completion", l.preferredCompletionDate],
      ]),
    },
  ].filter((g) => g.fields.length > 0);
}

function hasRequirementData(lead: Lead): boolean {
  const l = lead as any;
  return requirementGroups(lead).length > 0 || SCOPE_FIELDS.some(([, k]) => l[k])
    || !!(l.estimatedBudget || l.projectDescription || l.customerRequirements || l.specialRequests);
}

function RequirementSummary({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  const l = lead as any;
  const scope = SCOPE_FIELDS.filter(([, k]) => l[k]).map(([label]) => label);
  const groups = requirementGroups(lead);
  const brief = l.projectDescription || l.customerRequirements;

  if (!hasRequirementData(lead)) {
    return (
      <div className="rounded-xl border border-dashed bg-card/60 px-5 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">No requirement captured yet</p>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-[60ch]">
            Record the scope, property details and budget so the quote starts from what the customer asked for.
          </p>
        </div>
        <Button variant="forest" onClick={onEdit} className="shrink-0 active:scale-[0.98] transition-transform">
          <Pencil /> Add requirement
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:divide-x divide-y lg:divide-y-0">
        {/* What the customer wants — scope and brief read first. */}
        <div className="p-4 sm:p-5 space-y-5">
          {l.estimatedBudget ? (
            <div>
              <p className="text-xs text-muted-foreground">Estimated budget</p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {formatINR(l.estimatedBudget)}
              </p>
            </div>
          ) : null}
          {scope.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Scope of work</p>
              <ul className="flex flex-wrap gap-1.5">
                {scope.map((s) => (
                  <li key={s} className="inline-flex items-center gap-1 pl-1.5 pr-2.5 py-1 rounded-md border bg-muted/40 text-xs font-medium text-foreground">
                    <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} /> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {brief && <TextBlock label="Requirement" text={brief} />}
          {l.specialRequests && <TextBlock label="Special requests" text={l.specialRequests} />}
        </div>

        {/* Supporting facts, grouped so they scan as a spec sheet. */}
        {groups.length > 0 && (
          <div className="p-4 sm:p-5 space-y-5 bg-muted/20">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{g.title}</p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-3">
                  {g.fields.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-medium text-foreground mt-0.5 break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm leading-relaxed text-foreground/90 max-w-[70ch] whitespace-pre-line">{text}</p>
    </div>
  );
}

function budgetRange(lead: Lead): string | undefined {
  const min = (lead as any).minimumBudget;
  const max = (lead as any).maximumBudget;
  if (min == null && max == null) return undefined;
  return `${min != null ? formatINR(min) : "—"} – ${max != null ? formatINR(max) : "—"}`;
}

/* ─── Stage 3: convert ────────────────────────────────────────────────────── */

function ConvertPanel({ steps, closed, onConvert }: {
  steps: JourneyStep[]; closed: boolean; onConvert: () => void;
}) {
  const checks = [
    { label: "Requirement captured", ok: steps.find((s) => s.id === "requirement")?.status === "done" },
    { label: "Customer approved the quote", ok: steps.find((s) => s.id === "quote")?.status === "done" },
  ];
  const ready = checks.every((c) => c.ok);

  return (
    <div className={`rounded-xl border p-4 sm:p-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${ready && !closed ? "border-gold/40 bg-gold/[0.04]" : "bg-card"}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {closed ? "This lead is closed" : ready ? "Ready to convert" : "Before you convert"}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-[60ch]">
          Converting creates the project, the customer record and the initial billing schedule.
        </p>
        <ul className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-x-5 gap-y-1.5">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-1.5 text-sm ${c.ok ? "text-foreground" : "text-muted-foreground"}`}>
              {c.ok
                ? <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />
                : <CircleDashed className="h-4 w-4" />}
              {c.label}
              <span className="sr-only">{c.ok ? "(done)" : "(pending)"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col items-stretch md:items-end gap-1.5">
        <Button
          onClick={onConvert}
          variant={ready ? "default" : "outline"}
          className="active:scale-[0.98] transition-transform"
        >
          <Rocket /> Convert to Project
        </Button>
        {!ready && !closed && (
          <span className="text-xs text-muted-foreground md:text-right">You can still convert early.</span>
        )}
      </div>
    </div>
  );
}
