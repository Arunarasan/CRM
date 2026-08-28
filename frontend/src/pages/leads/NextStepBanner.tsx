import { ArrowRight, CheckCircle2, Compass, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadJourney } from "./journey";

/**
 * The single "what do I do next" prompt. Driven by the resolved journey so the user never has
 * to hunt through tabs to find the next action — the button jumps straight to the right stage.
 */
export default function NextStepBanner({
  journey,
  onGo,
}: {
  journey: LeadJourney;
  onGo: () => void;
}) {
  if (journey.loading) {
    return <div className="h-[68px] rounded-xl border bg-muted/40 animate-pulse" />;
  }

  if (journey.converted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-green-800">Deal won — converted to a project.</p>
          <p className="text-sm text-green-700">The full sales journey is complete.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onGo} className="shrink-0">
          View Journey <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    );
  }

  if (journey.closed) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
        <XCircle className="h-6 w-6 text-destructive shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-destructive">This lead is closed.</p>
          <p className="text-sm text-muted-foreground">No further steps are pending.</p>
        </div>
      </div>
    );
  }

  const step = journey.currentStep;
  if (!step) return null;

  const stepNumber = journey.steps.findIndex((s) => s.id === step.id) + 1;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-[220px]">
        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Compass className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Next step · {stepNumber} of {journey.steps.length}
          </p>
          <p className="font-semibold text-foreground">{step.label}</p>
          <p className="text-sm text-muted-foreground">{step.summary}</p>
        </div>
      </div>
      <Button onClick={onGo} className="shrink-0">
        {step.actionLabel} <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}
