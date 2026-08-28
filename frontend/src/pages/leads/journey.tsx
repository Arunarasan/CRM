import { useCallback, useEffect, useState } from "react";
import { leadApi } from "./leadApi";
import type { Lead } from "./constants";

// The lead → project journey, expressed as the five milestones the sales workflow already
// tracks. We resolve the *current* step from tangible records (measurement, BOQ, quotation,
// project) rather than the free-text stage field, so the "what's next" prompt is always
// truthful even if someone forgot to move the stage dropdown.

export type JourneyStepId = "requirement" | "visit" | "boq" | "quotation" | "convert";

export interface JourneyStep {
  id: JourneyStepId;
  label: string;
  status: "done" | "current" | "upcoming";
  /** One-line status shown under the label. */
  summary: string;
  /** Verb for the primary action button when this is the current step. */
  actionLabel: string;
}

export interface JourneyRecords {
  siteVisits: any[];
  measurements: any[];
  boqs: any[];
  quotations: any[];
  projects: any[];
}

export interface LeadJourney {
  steps: JourneyStep[];
  /** First incomplete step; null when the lead is converted or closed. */
  currentStep: JourneyStep | null;
  converted: boolean;
  closed: boolean;
  loading: boolean;
  reload: () => void;
  records: JourneyRecords;
}

const EMPTY_RECORDS: JourneyRecords = {
  siteVisits: [], measurements: [], boqs: [], quotations: [], projects: [],
};

export function useLeadJourney(leadId: string, lead: Lead | null): LeadJourney {
  const [records, setRecords] = useState<JourneyRecords>(EMPTY_RECORDS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!leadId) return;
    setLoading(true);
    Promise.all([
      leadApi.getSiteVisits(leadId).catch(() => ({ data: [] })),
      leadApi.getMeasurements(leadId).catch(() => ({ data: [] })),
      leadApi.getBoqs(leadId).catch(() => ({ data: [] })),
      leadApi.getQuotations(leadId).catch(() => ({ data: [] })),
      leadApi.getProjects(leadId).catch(() => ({ data: [] })),
    ])
      .then(([sv, m, b, q, p]) => setRecords({
        siteVisits: sv.data || [], measurements: m.data || [], boqs: b.data || [],
        quotations: q.data || [], projects: p.data || [],
      }))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { reload(); }, [reload]);

  const journey = resolveJourney(lead, records);
  return { ...journey, loading, reload, records };
}

/** Pure resolver — exported so it can be unit-tested / reused without the fetch. */
export function resolveJourney(
  lead: Lead | null,
  records: JourneyRecords,
): Pick<LeadJourney, "steps" | "currentStep" | "converted" | "closed"> {
  const anyScope = [
    (lead as any)?.reqKitchen, (lead as any)?.reqWardrobe, (lead as any)?.reqTvUnit,
    (lead as any)?.reqFalseCeiling, (lead as any)?.reqPainting, (lead as any)?.reqFlooring,
    (lead as any)?.reqElectrical, (lead as any)?.reqPlumbing, (lead as any)?.reqWoodFinish,
  ].some(Boolean);
  const hasRequirement = !!(
    (lead as any)?.projectDescription || (lead as any)?.customerRequirements ||
    (lead as any)?.roomsRequired || anyScope
  );

  const measurement = records.measurements[0];
  const hasMeasurement = !!measurement;
  const measurementDone = measurement?.status === "Completed";

  const hasBoq = records.boqs.length > 0;
  const approvedBoq = records.boqs.find((b: any) => b.status === "APPROVED");

  const hasQuotation = records.quotations.length > 0;

  const converted = !!lead?.isConverted || records.projects.length > 0;
  const closed = !!lead && !lead.isConverted && ["Lost", "Cancelled"].includes(lead.status);

  const defs: Array<{ id: JourneyStepId; label: string; done: boolean; summary: string; actionLabel: string }> = [
    {
      id: "requirement",
      label: "Collect Requirement",
      done: hasRequirement,
      summary: hasRequirement ? "Requirement captured" : "Capture what the customer wants",
      actionLabel: "Add Requirement Details",
    },
    {
      id: "visit",
      label: "Site Visit & Measurement",
      done: measurementDone,
      summary: measurementDone
        ? "Measurement completed"
        : hasMeasurement
          ? "Measurement recorded — complete it to proceed"
          : "Visit the site and record measurements",
      actionLabel: hasMeasurement ? "Complete Measurement" : "Record Site Visit & Measurement",
    },
    {
      id: "boq",
      label: "BOQ Creation",
      done: !!approvedBoq,
      summary: approvedBoq
        ? "BOQ approved"
        : hasBoq
          ? "BOQ drafted — get it approved to proceed"
          : "Generate the bill of quantities",
      actionLabel: hasBoq ? "Approve BOQ" : "Generate BOQ",
    },
    {
      id: "quotation",
      label: "Quotation",
      done: hasQuotation,
      summary: hasQuotation ? "Quotation raised" : "Raise the customer quotation",
      actionLabel: "Create Quotation",
    },
    {
      id: "convert",
      label: "Convert to Project",
      done: converted,
      summary: converted ? "Converted to project" : "Win the deal and start the project",
      actionLabel: "Convert to Project",
    },
  ];

  // The current step is the first one that isn't done. A closed lead has none.
  const currentIndex = closed ? -1 : defs.findIndex((d) => !d.done);

  const steps: JourneyStep[] = defs.map((d, i) => ({
    id: d.id,
    label: d.label,
    summary: d.summary,
    actionLabel: d.actionLabel,
    status: d.done ? "done" : i === currentIndex ? "current" : "upcoming",
  }));

  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;
  return { steps, currentStep, converted, closed };
}
