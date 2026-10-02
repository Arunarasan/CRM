import { useEffect, useRef } from "react";
import { Check, Pencil, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Lead, UserSummary } from "../constants";
import { formatINR } from "../constants";
import type { JourneyStepId, LeadJourney } from "../journey";
import QuoteWorkspace from "../quote/QuoteWorkspace";
import ProjectsTab from "./ProjectsTab";

/**
 * One guided view of the whole pre-sales pipeline: Requirement → Measurement & Quotation → Convert.
 * Every stage is always open (no collapsing) — site visit, measurement, BOQ pricing and the quotation
 * all live in one combined workspace because they only exist to produce the quote.
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
  const rowRefs = useRef<Partial<Record<JourneyStepId, HTMLDivElement | null>>>({});

  // Respond to the banner: scroll the requested stage into view.
  useEffect(() => {
    if (!focusStep) return;
    const el = rowRefs.current[focusStep.id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusStep]);

  return (
    <div className="space-y-4">
      {journey.steps.map((step, index) => (
        <div
          key={step.id}
          ref={(el) => { rowRefs.current[step.id] = el; }}
          className={`rounded-xl border shadow-sm scroll-mt-4 ${step.status === "current" ? "border-primary/40 bg-primary/[0.03]" : "bg-card"}`}
        >
          <div className="flex items-center gap-3 p-3">
            <StageBadge status={step.status} index={index} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{step.label}</span>
                <StatusChip status={step.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{step.summary}</p>
            </div>
          </div>
          <div className="px-3 pb-3 sm:pl-[52px] space-y-4">
            {renderStage(step.id)}
          </div>
        </div>
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

  const l = lead as any;
  // Only what's actually been captured — empty fields are noise here; Edit shows the full form.
  const fields = ([
    ["Category", l.requirementCategory], ["Property", l.propertyType], ["Stage", l.currentConstructionStage],
    ["Floors", l.floorCount], ["Area", l.areaSqft ? `${l.areaSqft} sq.ft` : null], ["Rooms", l.roomsRequired],
    ["Style", l.preferredDesignStyle], ["Material", l.preferredMaterial], ["Colour", l.preferredColorTheme],
    ["Budget", l.estimatedBudget ? formatINR(l.estimatedBudget) : null], ["Range", budgetRange(lead)],
    ["Payment", l.paymentPreference], ["Target", l.preferredCompletionDate],
  ] as const).filter(([, v]) => v != null && v !== "");
  const empty = fields.length === 0 && scope.length === 0
    && !l.projectDescription && !l.customerRequirements && !l.specialRequests;

  return (
    <Card>
      <CardContent className="p-3 sm:p-4 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          {empty ? (
            <p className="text-muted-foreground">Nothing captured yet.</p>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {fields.map(([label, value]) => <Field key={label} label={label} value={value} />)}
            </div>
          )}
          <Button size="sm" variant="outline" className="shrink-0" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>
        {scope.length > 0 && (
          <div>
            <span className="text-muted-foreground block text-xs mb-1">Scope of Work</span>
            <div className="flex flex-wrap gap-1.5">
              {scope.map((s) => (
                <span key={s} className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">✓ {s}</span>
              ))}
            </div>
          </div>
        )}
        {((lead as any).projectDescription || (lead as any).customerRequirements) && (
          <div>
            <span className="text-muted-foreground block text-xs mb-0.5">Requirement</span>
            <p className="text-foreground/90">{(lead as any).projectDescription || (lead as any).customerRequirements}</p>
          </div>
        )}
        {(lead as any).specialRequests && (
          <div>
            <span className="text-muted-foreground block text-xs mb-0.5">Special Requests</span>
            <p className="text-foreground/90">{(lead as any).specialRequests}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function budgetRange(lead: Lead): string | undefined {
  const min = (lead as any).minimumBudget;
  const max = (lead as any).maximumBudget;
  if (min == null && max == null) return undefined;
  return `${min != null ? formatINR(min) : "—"} – ${max != null ? formatINR(max) : "—"}`;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block text-xs mb-0.5">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}
