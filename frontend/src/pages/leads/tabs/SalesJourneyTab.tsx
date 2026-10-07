import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ClipboardList, FolderKanban, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lead, UserSummary } from "../constants";
import { formatINR, statusStyle } from "../constants";
import type { JourneyStep, JourneyStepId, LeadJourney } from "../journey";
import QuoteWorkspace from "../quote/QuoteWorkspace";

/**
 * The working view of the pre-sales pipeline. Progress and the next action live in the page header's
 * stage bar, so this tab is just the work, top to bottom: a compact requirement brief (reference),
 * the quote sheet (where the time goes), and the resulting project. The header bar scrolls here via
 * `focusStep`.
 */
export default function SalesJourneyTab({
  leadId,
  lead,
  journey,
  focusStep,
  canEdit,
  onChanged,
  onEditRequirement,
}: {
  leadId: string;
  lead: Lead;
  users: UserSummary[];
  journey: LeadJourney;
  /** Bumped by the parent to scroll a stage into view (header stage bar / primary action). */
  focusStep?: { id: JourneyStepId; nonce: number } | null;
  canEdit: boolean;
  onChanged: () => void;
  onEditRequirement: () => void;
}) {
  const sectionRefs = useRef<Partial<Record<JourneyStepId, HTMLElement | null>>>({});

  // Statuses come from fetched records; until the first fetch settles they'd all read "upcoming".
  // Later reloads keep the last known statuses on screen instead of flashing skeletons.
  const settled = useRef(false);
  if (!journey.loading) settled.current = true;
  const resolving = !settled.current;

  useEffect(() => {
    if (!focusStep) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Wait a frame so a freshly shown tab has laid out before scrolling.
    requestAnimationFrame(() =>
      sectionRefs.current[focusStep.id]?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  }, [focusStep]);

  const step = (id: JourneyStepId) => journey.steps.find((s) => s.id === id)!;
  const index = (id: JourneyStepId) => journey.steps.findIndex((s) => s.id === id);
  const ref = (id: JourneyStepId) => (el: HTMLElement | null) => { sectionRefs.current[id] = el; };

  return (
    <div className="space-y-6">
      <section ref={ref("requirement")} aria-labelledby="journey-requirement" className="scroll-mt-3">
        <RequirementBrief
          lead={lead}
          step={step("requirement")}
          index={index("requirement")}
          resolving={resolving}
          canEdit={canEdit}
          onEdit={onEditRequirement}
        />
      </section>

      <section ref={ref("quote")} aria-labelledby="journey-quote" className="scroll-mt-3 space-y-3">
        <StageHeader step={step("quote")} index={index("quote")} resolving={resolving} title="Measure & Quote" />
        <QuoteWorkspace leadId={leadId} onChanged={onChanged} />
      </section>

      <section ref={ref("convert")} aria-labelledby="journey-convert" className="scroll-mt-3 space-y-3">
        <StageHeader step={step("convert")} index={index("convert")} resolving={resolving} title="Project" />
        <ProjectOutcome lead={lead} journey={journey} />
      </section>
    </div>
  );
}

/* ─── Shared stage header ─────────────────────────────────────────────────── */

function StageHeader({ step, index, resolving, title, action }: {
  step: JourneyStep; index: number; resolving: boolean; title?: string; action?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 min-w-0">
      <StageMarker status={resolving ? "upcoming" : step.status} index={index} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 id={`journey-${step.id}`} className="text-[15px] font-bold tracking-tight text-slate-900">{title || step.label}</h2>
          {resolving ? <Skeleton className="h-5 w-16 rounded-full" /> : <StatusChip status={step.status} />}
        </div>
        {resolving
          ? <Skeleton className="mt-1 h-3.5 w-56" />
          : <p className="text-xs text-slate-500 mt-0.5 truncate">{step.summary}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-1.5">{action}</div>}
    </header>
  );
}

function StageMarker({ status, index }: { status: JourneyStep["status"]; index: number }) {
  const cls = status === "done" ? "bg-emerald-700 text-white"
    : status === "current" ? "bg-amber-600 text-white"
    : status === "missing" ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
    : "bg-slate-100 text-slate-500";
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${cls}`} aria-hidden>
      {status === "done" ? <Check className="h-4 w-4" strokeWidth={2.5} /> : index + 1}
    </span>
  );
}

const CHIP: Record<JourneyStep["status"], [string, string]> = {
  done: ["Done", "bg-emerald-100 text-emerald-800"],
  current: ["Now", "bg-amber-100 text-amber-800"],
  missing: ["Missing", "bg-rose-50 text-rose-600 ring-1 ring-rose-200"],
  upcoming: ["Next", "bg-slate-100 text-slate-500"],
};

function StatusChip({ status }: { status: JourneyStep["status"] }) {
  const [label, cls] = CHIP[status];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>{label}</span>;
}

const CARD = "rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

/* ─── 1. Requirement brief ────────────────────────────────────────────────── */

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
        ["Property type", l.propertyType], ["Construction stage", l.currentConstructionStage],
        ["Floors", l.floorCount], ["Area", l.areaSqft ? `${l.areaSqft} sq.ft` : null], ["Rooms", l.roomsRequired],
      ]),
    },
    {
      title: "Preferences",
      fields: keep([
        ["Design style", l.preferredDesignStyle], ["Material", l.preferredMaterial], ["Colour theme", l.preferredColorTheme],
      ]),
    },
    {
      title: "Commercials",
      fields: keep([
        ["Budget range", budgetRange(lead)], ["Payment", l.paymentPreference], ["Target completion", l.preferredCompletionDate],
      ]),
    },
  ].filter((g) => g.fields.length > 0);
}

function RequirementBrief({ lead, step, index, resolving, canEdit, onEdit }: {
  lead: Lead; step: JourneyStep; index: number; resolving: boolean; canEdit: boolean; onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const l = lead as any;
  const scope = SCOPE_FIELDS.filter(([, k]) => l[k]).map(([label]) => label);
  const products = (lead.requirementProduct || "").split(",").map((s) => s.trim()).filter(Boolean);
  const groups = requirementGroups(lead);
  const brief = l.projectDescription || l.customerRequirements;
  // Headline facts shown on the collapsed row — the few things a quote is priced against.
  const facts: FieldRow[] = ([
    ["Budget", l.estimatedBudget ? formatINR(l.estimatedBudget) : null],
    ["Category", l.requirementCategory],
    ["Area", l.areaSqft ? `${l.areaSqft} sq.ft` : null],
    ["Rooms", l.roomsRequired],
  ] as FieldRow[]).filter(([, v]) => v != null && v !== "");
  const tags = [...scope, ...products];
  const empty = facts.length === 0 && tags.length === 0 && !brief && !l.specialRequests && groups.length === 0;
  const hasMore = groups.length > 0 || !!l.specialRequests || (brief && brief.length > 140);

  const edit = canEdit && (
    <Button size="sm" variant={empty ? "outline" : "ghost"} onClick={onEdit}
      className={empty ? "h-8 rounded-lg border-slate-200 text-emerald-800 font-semibold" : "h-8 px-2.5 text-slate-500 hover:text-slate-900"}>
      {empty ? <><Plus className="h-4 w-4 mr-1" /> Add requirement</> : <><Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit</>}
    </Button>
  );

  return (
    <div className={`${CARD} p-4`}>
      <StageHeader step={step} index={index} resolving={resolving} title="Requirement" action={edit} />

      {empty ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          <ClipboardList className="h-4 w-4 shrink-0 text-slate-400" />
          Nothing captured yet — the quote can still go ahead, but noting the scope and budget helps price it.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5 sm:pl-11">
          {facts.length > 0 && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1.5">
              {facts.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[11px] text-slate-400">{label}</dt>
                  <dd className="text-sm font-semibold text-slate-800 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Scope">
              {tags.map((t) => (
                <li key={t} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  <Check className="h-3 w-3 text-emerald-700" strokeWidth={2.5} /> {t}
                </li>
              ))}
            </ul>
          )}
          {brief && (
            <p className={`text-sm leading-relaxed text-slate-700 whitespace-pre-line max-w-[75ch] ${open ? "" : "line-clamp-2"}`}>{brief}</p>
          )}

          {open && (
            <div className="grid gap-4 @container border-t border-slate-100 pt-3">
              {l.specialRequests && (
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">Special requests</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line max-w-[75ch]">{l.specialRequests}</p>
                </div>
              )}
              {groups.map((g) => (
                <div key={g.title}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{g.title}</p>
                  <dl className="grid grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-5 gap-x-5 gap-y-2">
                    {g.fields.map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-xs text-slate-500">{label}</dt>
                        <dd className="text-sm font-medium text-slate-800 break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline">
              {open ? "Show less" : "Show all details"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function budgetRange(lead: Lead): string | undefined {
  const min = (lead as any).minimumBudget;
  const max = (lead as any).maximumBudget;
  if (min == null && max == null) return undefined;
  return `${min != null ? formatINR(min) : "—"} – ${max != null ? formatINR(max) : "—"}`;
}

/* ─── 3. Project outcome ──────────────────────────────────────────────────── */

function ProjectOutcome({ lead, journey }: { lead: Lead; journey: LeadJourney }) {
  const projects = journey.records.projects as any[];

  if (projects.length > 0) {
    return (
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className={`${CARD} px-4 py-3 flex flex-wrap items-center gap-3`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <FolderKanban className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 truncate">{p.projectName || `Project #${p.id}`}</span>
                {p.projectCode && <span className="text-xs font-mono text-slate-400">{p.projectCode}</span>}
                {p.status && <span className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${statusStyle(p.status)}`}>{p.status.replace(/_/g, " ")}</span>}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {p.budget ? <>Value <span className="font-semibold text-slate-700">{formatINR(p.budget)}</span></> : "No value set"}
                {typeof p.progress === "number" ? ` · ${p.progress}% complete` : ""}
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="rounded-lg">
              <Link to={`/projects/${p.id}`}>Open project</Link>
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  const text = journey.closed
    ? `This lead is ${lead.status.toLowerCase()} — reopen it to carry on.`
    : "When the customer approves, press Create Project at the bottom of the quote. It creates the customer and the project and records the advance in one step.";
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-500 sm:ml-11">{text}</p>
  );
}
