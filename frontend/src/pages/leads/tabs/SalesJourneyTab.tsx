import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, Check, ChevronDown, ClipboardList, FolderKanban, Pencil, Plus, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lead, UserSummary } from "../constants";
import { formatINR, statusStyle } from "../constants";
import type { JourneyStepId, LeadJourney } from "../journey";
import QuoteWorkspace from "../quote/QuoteWorkspace";

/**
 * The working view of the pre-sales pipeline. Progress lives in the page header's stage bar, so this
 * tab is only the work: a one-line requirement brief (full details live on Overview), the quote
 * (heading, sheet, price), and what happens next — Customer Approved → Create Project — or the
 * project it became. The header bar scrolls here via `focusStep`.
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

  useEffect(() => {
    if (!focusStep) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Wait a frame so a freshly shown tab has laid out before scrolling.
    requestAnimationFrame(() =>
      sectionRefs.current[focusStep.id]?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  }, [focusStep]);

  const ref = (id: JourneyStepId) => (el: HTMLElement | null) => { sectionRefs.current[id] = el; };

  return (
    <div className="space-y-4">
      {journey.closed && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>This lead is {lead.status.toLowerCase()} — the quote is read-only. Reopen the lead to carry on.</span>
        </div>
      )}

      <section ref={ref("requirement")} aria-label="Requirement" className="scroll-mt-3">
        <RequirementLine lead={lead} canEdit={canEdit} onEdit={onEditRequirement} />
      </section>

      <section ref={ref("quote")} aria-label="Quote" className="scroll-mt-3">
        <QuoteWorkspace leadId={leadId} onChanged={onChanged} readOnly={journey.closed} />
      </section>

      <section ref={ref("convert")} aria-label="Project" className="scroll-mt-3">
        <NextStep lead={lead} journey={journey} />
      </section>
    </div>
  );
}

const CARD = "rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

/* ─── Requirement: one line, expandable ──────────────────────────────────── */

const SCOPE_FIELDS: Array<[string, string]> = [
  ["Modular Kitchen", "reqKitchen"], ["Wardrobe", "reqWardrobe"], ["TV Unit", "reqTvUnit"],
  ["False Ceiling", "reqFalseCeiling"], ["Painting", "reqPainting"], ["Flooring", "reqFlooring"],
  ["Electrical", "reqElectrical"], ["Plumbing", "reqPlumbing"], ["Wood Finish", "reqWoodFinish"],
];

/** ₹8,50,000 -> ₹8.5L */
function compactINR(v?: number | null): string {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return "";
  const fmt = (x: number, unit: string) => `${Number(x.toFixed(x >= 10 ? 0 : 1))}${unit}`;
  if (n >= 1e7) return `₹${fmt(n / 1e7, "Cr")}`;
  if (n >= 1e5) return `₹${fmt(n / 1e5, "L")}`;
  if (n >= 1e3) return `₹${fmt(n / 1e3, "K")}`;
  return `₹${n}`;
}

function budgetText(l: any): string {
  const min = compactINR(l.minimumBudget), max = compactINR(l.maximumBudget), est = compactINR(l.estimatedBudget);
  if (min && max) return `${min}–${max.replace("₹", "")}`;
  return est || min || max;
}

function RequirementLine({ lead, canEdit, onEdit }: { lead: Lead; canEdit: boolean; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const l = lead as any;
  const scope = SCOPE_FIELDS.filter(([, k]) => l[k]).map(([label]) => label);
  const products = (lead.requirementProduct || "").split(",").map((s) => s.trim()).filter(Boolean);
  const brief: string | undefined = l.projectDescription || l.customerRequirements;
  // The few things a quote is priced against, on one line.
  const facts = [
    l.requirementCategory,
    l.areaSqft ? `${l.areaSqft} sq.ft` : "",
    l.roomsRequired,
    budgetText(l) ? `Budget ${budgetText(l)}` : "",
  ].filter(Boolean) as string[];
  const tags = [...scope, ...products];
  const empty = facts.length === 0 && tags.length === 0 && !brief && !l.specialRequests;

  if (empty) {
    // Converted / closed leads can't add it any more — the prompt would only be noise.
    if (!canEdit) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-sm">
        <ClipboardList className="h-4 w-4 shrink-0 text-amber-700" />
        <span className="min-w-0 flex-1 text-amber-900">
          <span className="font-semibold">No requirement captured yet</span>
          <span className="text-amber-800/80"> — the quote can go ahead, but scope and budget help price it.</span>
        </span>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} className="h-8 rounded-lg border-amber-300 bg-white font-semibold text-amber-900 hover:bg-amber-100">
            <Plus className="h-4 w-4 mr-1" /> Add requirement
          </Button>
        )}
      </div>
    );
  }

  const hasMore = tags.length > 0 || !!brief || !!l.specialRequests;
  return (
    <div className={`${CARD} px-4 py-2.5`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">Requirement</span>
        <span className="min-w-0 flex-1 line-clamp-2 sm:line-clamp-1 text-sm font-medium text-slate-800" title={facts.join(" · ")}>
          {facts.length ? facts.join(" · ") : tags.slice(0, 4).join(", ")}
        </span>
        {hasMore && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
            {open ? "Less" : "More"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        {canEdit && (
          <button type="button" onClick={onEdit} aria-label="Edit requirement" title="Edit requirement"
            className="h-7 w-7 shrink-0 grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2.5 space-y-2.5 border-t border-slate-100 pt-2.5">
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Scope">
              {tags.map((t) => (
                <li key={t} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  <Check className="h-3 w-3 text-emerald-700" strokeWidth={2.5} /> {t}
                </li>
              ))}
            </ul>
          )}
          {brief && <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line max-w-[75ch]">{brief}</p>}
          {l.specialRequests && (
            <p className="text-sm text-slate-700 whitespace-pre-line max-w-[75ch]">
              <span className="text-xs text-slate-500">Special requests: </span>{l.specialRequests}
            </p>
          )}
          <p className="text-xs text-slate-500">Property, site and dates are on the Overview tab.</p>
        </div>
      )}
    </div>
  );
}

/* ─── What happens next: approval → project, or the project it became ───── */

function NextStep({ lead, journey }: { lead: Lead; journey: LeadJourney }) {
  const projects = journey.records.projects as any[];

  if (projects.length > 0) {
    return (
      <ul className="space-y-2">
        {projects.map((p) => {
          const progress = typeof p.progress === "number" ? Math.max(0, Math.min(100, p.progress)) : null;
          return (
            <li key={p.id} className={`${CARD} px-4 py-3 flex flex-wrap items-center gap-3`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <FolderKanban className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Project</span>
                  <span className="font-semibold text-slate-900 truncate">{p.projectName || `Project #${p.id}`}</span>
                  {p.projectCode && <span className="text-xs font-mono text-slate-400">{p.projectCode}</span>}
                  {p.status && <span className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${statusStyle(p.status)}`}>{p.status.replace(/_/g, " ")}</span>}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span>{p.budget ? <>Value <span className="font-semibold text-slate-700">{formatINR(p.budget)}</span></> : "No value set"}</span>
                  {progress != null && (
                    <span className="flex items-center gap-2 min-w-[8rem] flex-1 max-w-xs">
                      <span className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
                        <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }} />
                      </span>
                      <span className="tabular-nums">{progress}%</span>
                    </span>
                  )}
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-lg">
                <Link to={`/projects/${p.id}`}>Open project</Link>
              </Button>
            </li>
          );
        })}
      </ul>
    );
  }

  if (journey.closed) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-500">
        <RotateCcw className="h-4 w-4 shrink-0" /> No project — this lead is {lead.status.toLowerCase()}.
      </p>
    );
  }

  // Not converted yet: name the real buttons, in order, and mark the one that's done.
  const quotes = journey.records.quotations as any[];
  const approved = quotes.some((q) => q.status === "APPROVED" || q.status === "CONVERTED");
  const hasQuote = quotes.length > 0 || (journey.records.boqs as any[]).length > 0;
  const steps: { label: string; hint: string; done: boolean; now: boolean }[] = [
    { label: "Customer Approved", hint: "when the customer agrees to the final price", done: approved, now: hasQuote && !approved },
    { label: "Create Project", hint: "makes the customer + project and records the advance", done: false, now: approved },
  ];
  return (
    <div className={`${CARD} px-4 py-3`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Next</span>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-300" aria-hidden>→</span>}
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold ${s.done
                ? "bg-emerald-50 text-emerald-800" : s.now ? "bg-[#1F5C3F] text-white" : "bg-slate-100 text-slate-500"}`}>
                {s.done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <span className="tabular-nums text-xs">{i + 1}</span>}
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {!hasQuote
          ? "Start the quote above first."
          : approved
            ? <>Customer approved — press <b className="text-slate-700">Create Project</b> in the quote's bottom bar. It creates the customer and the project and records the advance in one step.</>
            : <>Press <b className="text-slate-700">Customer Approved</b> in the quote's bottom bar {steps[0].hint}; then <b className="text-slate-700">Create Project</b> appears there.</>}
        {hasQuote && (
          <button type="button" className="ml-1.5 inline-flex items-center gap-0.5 font-semibold text-emerald-800 hover:underline"
            onClick={() => document.querySelector<HTMLElement>("[data-quote-actions]")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            Show me <ArrowDown className="h-3 w-3" />
          </button>
        )}
      </p>
    </div>
  );
}
