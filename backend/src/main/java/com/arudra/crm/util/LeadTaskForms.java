package com.arudra.crm.util;

/**
 * Maps a lead-workflow task template code to the structured completion form it should show.
 * Kept as a static util so both the employee-task read path (to advertise {@code formType} on a
 * task) and {@link com.arudra.crm.service.LeadTaskFormService} (to process a submission) share one
 * source of truth without a service dependency cycle.
 */
public final class LeadTaskForms {

    private LeadTaskForms() {}

    /** Form type for a template code, or null when the task has no structured form. */
    public static String formTypeFor(String templateCode) {
        if (templateCode == null) return null;
        return switch (templateCode) {
            case "TT_CONTACT_CUSTOMER", "TT_FOLLOWUP_QUOTE" -> "FOLLOW_UP";
            // The four-task lead workflow (V45) collapses requirement gathering into one task; it reuses
            // the same REQUIREMENT form the old TT_UNDERSTAND_REQ task carried.
            case "TT_COLLECT_REQUIREMENT", "TT_UNDERSTAND_REQ" -> "REQUIREMENT";
            case "TT_QUALIFY_LEAD" -> "QUALIFY";
            case "TT_REVIEW_LEAD" -> "REVIEW";
            // Site-visit tasks are module-driven (see below), not quick forms — they create a real
            // SiteVisit record in the Site Visit module and advance the workflow via onSiteVisitCompleted.
            default -> null;
        };
    }

    /**
     * Module-driven tasks are done in a dedicated module (Measurement / BOQ), never by a quick form or
     * the generic Complete button — they close automatically via a business event when the module work
     * is finalized (onMeasurementCompleted / onBoqApproved). Completing them by hand would falsely
     * advance the workflow, so the UI links out to the module and the manual-complete path is blocked.
     */
    public static boolean isModuleDriven(String templateCode) {
        return switch (templateCode == null ? "" : templateCode) {
            case "TT_MEASURE_SITE", "TT_PREPARE_BOQ", "TT_SCHEDULE_VISIT", "TT_CONDUCT_VISIT",
                 "TT_VISIT_MEASURE", "TT_GENERATE_QUOTE", "TT_BOQ_QUOTE" -> true;
            default -> false;
        };
    }

    /**
     * Deep link to the FULL module page where a module-driven task's real work is done. These are the
     * complete desktop pages (property info, floors, drawings, full item/pricing editing) — a field
     * employee is allowed onto them via the DesktopGuard workflow allow-list. Null when not module-driven.
     */
    public static String moduleLink(String templateCode, Long leadId) {
        if (leadId == null) return null;
        return switch (templateCode == null ? "" : templateCode) {
            case "TT_MEASURE_SITE" -> "/measurements/new?leadId=" + leadId;
            // Combined step: a single compact in-portal page records the site visit AND the room-by-room
            // measurement, creating both real records in one trip (measurement completion advances the workflow).
            case "TT_VISIT_MEASURE" -> "/employee/visit-measure/new?leadId=" + leadId;
            case "TT_SCHEDULE_VISIT", "TT_CONDUCT_VISIT" -> "/site-visits/new?leadId=" + leadId;
            case "TT_PREPARE_BOQ" -> "/employee/boq/new?leadId=" + leadId;
            case "TT_GENERATE_QUOTE" -> "/employee/quotation/new?leadId=" + leadId;
            // Combined step: one page does the BOQ then the quotation in a two-step flow.
            case "TT_BOQ_QUOTE" -> "/employee/boq-quote/new?leadId=" + leadId;
            default -> null;
        };
    }

    /** Button label for the module link. */
    public static String moduleLabel(String templateCode) {
        return switch (templateCode == null ? "" : templateCode) {
            case "TT_MEASURE_SITE" -> "Open Measurement page";
            case "TT_VISIT_MEASURE" -> "Open Site Visit & Measurement";
            case "TT_PREPARE_BOQ" -> "Open BOQ page";
            case "TT_SCHEDULE_VISIT" -> "Open Site Visit page";
            case "TT_CONDUCT_VISIT" -> "Open Site Visit page";
            case "TT_GENERATE_QUOTE" -> "Open Quotation page";
            case "TT_BOQ_QUOTE" -> "Open BOQ & Quotation";
            default -> null;
        };
    }
}
