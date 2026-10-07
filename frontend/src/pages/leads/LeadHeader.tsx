import { Fragment } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { JourneyStepId, LeadJourney } from "./journey";

// The lead page's stage bar — a slim one-line strip, because it is pinned at the top of the page with
// the header and tabs. Colours match the Project page's stage bar (ProjectJourneyHeader). Sized with
// container queries (@2xl, @5xl) because the sidebar eats width — the page root is the @container.

const STEP_SHORT: Record<JourneyStepId, string> = {
  requirement: "Requirement",
  quote: "Measure & Quote",
  convert: "Project",
};

/** Requirement → Measure & Quote → Project. Each step jumps to its section in the Sales Journey tab. */
export function LeadJourneyBar({ journey, onOpen }: { journey: LeadJourney; onOpen: (id: JourneyStepId) => void }) {
  if (journey.loading && !journey.steps.length) return null;
  return (
    <div className="flex items-stretch gap-1.5" aria-label="Sales journey">
      {journey.steps.map((s, i) => {
        const done = s.status === "done";
        const current = s.status === "current";
        const missing = s.status === "missing";
        const box = done
          ? "border-emerald-200 bg-emerald-50/70"
          : current ? "border-amber-300 bg-amber-50/80" : "border-slate-100 bg-white";
        const circle = done ? "bg-emerald-700 text-white" : current ? "bg-amber-600 text-white"
          : missing ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : "bg-slate-100 text-slate-500";
        return (
          <Fragment key={s.id}>
            {i > 0 && <ChevronRight className="hidden @2xl:block h-4 w-4 shrink-0 self-center text-slate-300" aria-hidden />}
            <button type="button" onClick={() => onOpen(s.id)} aria-current={current ? "step" : undefined}
              title={`${STEP_SHORT[s.id]}: ${s.summary}`}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2 @2xl:px-2.5 py-1.5 text-left transition-colors hover:brightness-[0.98] ${box}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${circle}`}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-900">{STEP_SHORT[s.id]}</span>
                {current && <span className="hidden @5xl:block truncate text-[11px] text-slate-500">{s.summary}</span>}
              </span>
              <span className={`hidden @2xl:inline shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${done ? "bg-emerald-100 text-emerald-800" : current ? "bg-amber-100 text-amber-800" : missing ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                {done ? "Done" : current ? "Now" : missing ? "Missing" : "Next"}
              </span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
