import { useCallback, useEffect, useState } from "react";
import { leadApi } from "./leadApi";
import type { Lead } from "./constants";

// The lead → project journey, expressed as three milestones. Site visit, measurement, BOQ and
// quotation are one combined "Measurement & Quotation" stage — they only exist to produce the quote. We resolve the *current* step from tangible records (measurement, BOQ, quotation,
// project) rather than the free-text stage field, so the "what's next" prompt is always
// truthful even if someone forgot to move the stage dropdown.

export type JourneyStepId = "requirement" | "quote" | "convert";

export interface JourneyStep {
  id: JourneyStepId;
  label: string;
  /** "missing" = skipped and never filled in, while a later step is already under way. */
  status: "done" | "current" | "upcoming" | "missing";
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
    (lead as any)?.roomsRequired || anyScope ||
    // The Category → Product enquiry fields (and a budget) count too — newer leads capture only these.
    lead?.requirementCategory || lead?.requirementProduct || (lead as any)?.estimatedBudget
  );

  const measurement = records.measurements[0];
  const hasMeasurement = !!measurement;

  const hasBoq = records.boqs.length > 0;

  const hasQuotation = records.quotations.length > 0;
  const customerApproved = records.quotations.some((q: any) => q.status === "APPROVED" || q.status === "CONVERTED");

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
      id: "quote",
      label: "Measurement & Quotation",
      // Measure, price, share and customer approval all happen on one page — the stage is done when
      // the customer has approved.
      done: customerApproved,
      summary: customerApproved
        ? "Customer approved the quote"
        : hasQuotation
          ? "Quote shared — mark it approved when the customer agrees"
          : hasBoq
            ? "Fill the sheet, share the quote, mark customer approved"
            : hasMeasurement
              ? "Measurement recorded — open the quote sheet"
              : "Visit the site and start the quote sheet",
      actionLabel: customerApproved ? "Open Quote" : hasBoq ? "Continue Quote" : "Start Quote",
    },
    {
      id: "convert",
      label: "Convert to Project",
      done: converted,
      summary: converted ? "Converted to project" : "Win the deal and start the project",
      actionLabel: "Convert to Project",
    },
  ];

  // The current step is the first one that isn't done — except that sales often skip straight to
  // the quote: once quoting has started, an empty requirement is "missing", not where the deal is.
  const quoteStarted = hasMeasurement || hasBoq || hasQuotation;
  const currentIndex = closed ? -1
    : defs.findIndex((d) => !d.done && !(d.id === "requirement" && quoteStarted));

  const steps: JourneyStep[] = defs.map((d, i) => ({
    id: d.id,
    label: d.label,
    summary: d.summary,
    actionLabel: d.actionLabel,
    status: d.done ? "done" : i === currentIndex ? "current"
      : (currentIndex >= 0 && i < currentIndex) || defs.slice(i + 1).some((x) => x.done) ? "missing" : "upcoming",
  }));

  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;
  return { steps, currentStep, converted, closed };
}
