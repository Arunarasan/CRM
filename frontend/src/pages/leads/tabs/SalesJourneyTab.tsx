import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Pencil, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead, UserSummary } from "../constants";
import { formatINR } from "../constants";
import type { JourneyStepId, LeadJourney } from "../journey";
import SiteVisitsTab from "./SiteVisitsTab";
import MeasurementsTab from "./MeasurementsTab";
import BoqTab from "./BoqTab";
import QuotationsTab from "./QuotationsTab";
import ProjectsTab from "./ProjectsTab";
import TasksTab from "./TasksTab";
import TaskDataTab from "./TaskDataTab";

/**
 * One guided view of the whole pre-sales pipeline. Each milestone is a collapsible stage that
 * hosts the existing stage component — nothing about how a measurement / BOQ / quotation is
 * created changes, it's just presented as one linear path with the current step opened for you.
 */
export default function SalesJourneyTab({
  leadId,
  lead,
  users,
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
  /** Bumped by the parent to auto-open a stage (e.g. from the Next-Step banner). */
  focusStep?: { id: JourneyStepId; nonce: number } | null;
  onChanged: () => void;
  onEditRequirement: () => void;
  onConvert: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<JourneyStepId>>(new Set());
  const rowRefs = useRef<Partial<Record<JourneyStepId, HTMLDivElement | null>>>({});

  // Open the current step by default once the journey resolves.
  useEffect(() => {
    if (journey.currentStep) setExpanded((prev) => new Set(prev).add(journey.currentStep!.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.currentStep?.id]);

  // Respond to the banner: open and scroll the requested stage into view.
  useEffect(() => {
    if (!focusStep) return;
    setExpanded((prev) => new Set(prev).add(focusStep.id));
    const el = rowRefs.current[focusStep.id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusStep]);

  const toggle = (id: JourneyStepId) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      {journey.steps.map((step, index) => {
        const isOpen = expanded.has(step.id);
        const isLast = index === journey.steps.length - 1;
        return (
          <div key={step.id} ref={(el) => { rowRefs.current[step.id] = el; }} className="relative">
            {/* Connector line down to the next stage */}
            {!isLast && <div className="absolute left-[19px] top-11 bottom-0 w-px bg-border" />}

            <div className={`rounded-xl border shadow-sm ${step.status === "current" ? "border-primary/40 bg-primary/[0.03]" : "bg-card"}`}>
              <button
                type="button"
                onClick={() => toggle(step.id)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                <StageBadge status={step.status} index={index} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{step.label}</span>
                    <StatusChip status={step.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.summary}</p>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pl-[52px] space-y-4">
                  {renderStage(step.id)}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Supporting detail that spans the whole journey, kept out of the way until needed. */}
      <div className="pt-2 space-y-3">
        <TasksTab leadId={leadId} users={users} />
        <TaskDataTab leadId={leadId} />
      </div>
    </div>
  );

  function renderStage(id: JourneyStepId) {
    switch (id) {
      case "requirement":
        return <RequirementSummary lead={lead} onEdit={onEditRequirement} />;
      case "visit":
        return (
          <>
            <SiteVisitsTab leadId={leadId} onChanged={onChanged} />
            <MeasurementsTab leadId={leadId} />
          </>
        );
      case "boq":
        return <BoqTab leadId={leadId} />;
      case "quotation":
        return <QuotationsTab leadId={leadId} />;
      case "convert":
        return (
          <>
            {!journey.converted && (
              <Card className="border-primary/30 bg-primary/[0.03]">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">Ready to win this deal?</p>
                    <p className="text-xs text-muted-foreground">
                      Convert this lead into a project, customer and initial billing schedule.
                    </p>
                  </div>
                  <Button onClick={onConvert} className="bg-green-600 hover:bg-green-700 text-white shrink-0">
                    <Rocket className="h-4 w-4 mr-2" /> Convert to Project
                  </Button>
                </CardContent>
              </Card>
            )}
            <ProjectsTab leadId={leadId} />
          </>
        );
    }
  }
}

function StageBadge({ status, index }: { status: string; index: number }) {
  if (status === "done") {
    return (
      <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 relative z-10">
        <Check className="h-5 w-5" />
      </div>
    );
  }
  const cls = status === "current"
    ? "border-primary text-primary bg-primary/10"
    : "border-muted-foreground/30 text-muted-foreground bg-background";
  return (
    <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 relative z-10 ${cls}`}>
      {index + 1}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "done") {
    return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Done</span>;
  }
  if (status === "current") {
    return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">In progress</span>;
  }
  return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Upcoming</span>;
}

function RequirementSummary({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  const scope = [
    ["Modular Kitchen", (lead as any).reqKitchen], ["Wardrobe", (lead as any).reqWardrobe],
    ["TV Unit", (lead as any).reqTvUnit], ["False Ceiling", (lead as any).reqFalseCeiling],
    ["Painting", (lead as any).reqPainting], ["Flooring", (lead as any).reqFlooring],
    ["Electrical", (lead as any).reqElectrical], ["Plumbing", (lead as any).reqPlumbing],
    ["Wood Finish", (lead as any).reqWoodFinish],
  ].filter(([, v]) => v).map(([label]) => label as string);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Requirement</CardTitle>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-1" /> Edit Requirement
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Property Type" value={(lead as any).propertyType} />
          <Field label="Area (sq.ft)" value={(lead as any).areaSqft} />
          <Field label="Design Style" value={(lead as any).preferredDesignStyle} />
          <Field label="Est. Budget" value={formatINR((lead as any).estimatedBudget)} />
        </div>
        {scope.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {scope.map((s) => (
              <span key={s} className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">✓ {s}</span>
            ))}
          </div>
        )}
        {((lead as any).projectDescription || (lead as any).customerRequirements) && (
          <p className="text-muted-foreground">
            {(lead as any).projectDescription || (lead as any).customerRequirements}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block text-xs mb-0.5">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}
