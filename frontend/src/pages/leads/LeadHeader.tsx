import { Fragment } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { JourneyStepId, LeadJourney } from "./journey";

// The lead page's stage bar, styled to match the Project page's (ProjectJourneyHeader) so the
// lead → project hand-off feels like one product. Layout uses container queries (@3xl, @6xl …) because
// the sidebar eats width — the page scroll div is the @container.

const STEP_SHORT: Record<JourneyStepId, string> = {
  requirement: "Requirement",
  quote: "Measure & Quote",
  convert: "Project",
};

/** Requirement → Measure & Quote → Project, same visual language as the project's stage bar. */
export function LeadJourneyBar({ journey, onOpen }: { journey: LeadJourney; onOpen: (id: JourneyStepId) => void }) {
  if (journey.loading && !journey.steps.length) return null;
  return (
    <div className="mt-3 grid grid-cols-1 @3xl:grid-cols-3 @6xl:flex @6xl:items-stretch gap-2.5" aria-label="Sales journey">
      {journey.steps.map((s, i) => {
        const done = s.status === "done";
        const current = s.status === "current";
        const missing = s.status === "missing";
        const box = done
          ? "border-emerald-200 bg-emerald-50/60"
          : current ? "border-amber-300 bg-amber-50/70" : "border-slate-100 bg-white";
        const circle = done ? "bg-emerald-700 text-white" : current ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600";
        return (
          <Fragment key={s.id}>
            {i > 0 && <div className="hidden @6xl:flex items-center text-slate-300 shrink-0"><ArrowRight className="h-4 w-4" /></div>}
            <button type="button" onClick={() => onOpen(s.id)} aria-current={current ? "step" : undefined}
              className={`flex-1 min-w-0 text-left rounded-2xl border px-3.5 py-2.5 @3xl:py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-10px_rgba(0,0,0,0.18)] ${box}`}>
              <div className={`flex gap-3 ${current ? "items-start" : "items-center @3xl:items-start"}`}>
                <span className={`flex h-8 w-8 @3xl:h-9 @3xl:w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${circle}`}>
                  {done ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm @6xl:text-[15px] font-bold text-slate-900 truncate">{STEP_SHORT[s.id]}</div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${done ? "bg-emerald-100 text-emerald-800" : current ? "bg-amber-100 text-amber-800" : missing ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : "bg-slate-100 text-slate-500"}`}>
                      {done ? "Done" : current ? "Now" : missing ? "Missing" : "Next"}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-xs text-slate-500 line-clamp-2 ${current ? "" : "hidden @3xl:block"}`}>{s.summary}</p>
                </div>
              </div>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
