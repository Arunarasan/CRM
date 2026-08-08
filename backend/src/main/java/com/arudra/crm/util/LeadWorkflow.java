package com.arudra.crm.util;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Central definition of the lead lifecycle: statuses, pipeline stages and the
 * mapping between them. Used by LeadService (auto stage derivation, dashboard
 * groupings) and exposed to the frontend via /api/leads/meta.
 */
public final class LeadWorkflow {

    private LeadWorkflow() {
    }

    public static final List<String> SOURCES = Arrays.asList(
            "Walk-in", "Phone Call", "WhatsApp", "Website", "Facebook", "Instagram",
            "Google", "Referral", "Existing Customer", "Exhibition", "Email", "Other");

    public static final List<String> TYPES = Arrays.asList(
            "Residential", "Commercial", "Office", "Villa", "Apartment", "Modular Kitchen",
            "Wardrobe", "Renovation", "False Ceiling", "Wood Work", "Interior Decoration", "Other");

    public static final List<String> STATUSES = Arrays.asList(
            "New", "Contacted", "Follow-up", "Interested",
            "Site Visit Scheduled", "Site Visit Completed",
            "Measurement Scheduled", "Measurement Completed",
            "Quotation Preparing", "Quotation Sent", "Quotation Revised",
            "Quotation Approved", "Quotation Rejected",
            "Negotiation", "Project Confirmed", "Project Started",
            "On Hold", "Lost", "Cancelled", "Completed");

    public static final List<String> STAGES = Arrays.asList(
            "New Lead", "First Contact", "Requirement Discussion", "Follow-up",
            "Site Visit", "Measurement", "Quotation", "Negotiation", "Approval", "Project");

    public static final List<String> TEMPERATURES = Arrays.asList("Hot", "Warm", "Cold");

    public static final List<String> TASK_TYPES = Arrays.asList(
            "Call Customer", "Site Visit", "Measurement", "Design", "Quotation", "Reminder", "Meeting");

    public static final List<String> DOCUMENT_CATEGORIES = Arrays.asList(
            "Property Images", "Reference Images", "Floor Plans", "Customer Documents",
            "Site Photos", "Videos", "Agreements", "Other");

    public static final List<String> COMMUNICATION_TYPES = Arrays.asList(
            "Phone Call", "WhatsApp", "Email", "Meeting", "Office Visit", "Site Visit", "SMS", "Video Call");

    /** Statuses that mean the lead is no longer in the open pipeline. */
    public static final List<String> CLOSED_STATUSES = Arrays.asList("Lost", "Cancelled", "Completed");

    /** Statuses where a quotation exists but is not yet decided. */
    public static final List<String> QUOTATION_PENDING_STATUSES = Arrays.asList(
            "Quotation Preparing", "Quotation Sent", "Quotation Revised");

    private static final Map<String, String> STATUS_TO_STAGE = new LinkedHashMap<>();

    static {
        STATUS_TO_STAGE.put("New", "New Lead");
        STATUS_TO_STAGE.put("Contacted", "First Contact");
        STATUS_TO_STAGE.put("Follow-up", "Follow-up");
        STATUS_TO_STAGE.put("Interested", "Requirement Discussion");
        STATUS_TO_STAGE.put("Site Visit Scheduled", "Site Visit");
        STATUS_TO_STAGE.put("Site Visit Completed", "Site Visit");
        STATUS_TO_STAGE.put("Measurement Scheduled", "Measurement");
        STATUS_TO_STAGE.put("Measurement Completed", "Measurement");
        STATUS_TO_STAGE.put("Quotation Preparing", "Quotation");
        STATUS_TO_STAGE.put("Quotation Sent", "Quotation");
        STATUS_TO_STAGE.put("Quotation Revised", "Quotation");
        STATUS_TO_STAGE.put("Quotation Rejected", "Quotation");
        STATUS_TO_STAGE.put("Quotation Approved", "Approval");
        STATUS_TO_STAGE.put("Negotiation", "Negotiation");
        STATUS_TO_STAGE.put("Project Confirmed", "Project");
        STATUS_TO_STAGE.put("Project Started", "Project");
        STATUS_TO_STAGE.put("Completed", "Project");
    }

    /**
     * Derive the pipeline stage for a status. Statuses that do not advance the
     * pipeline (On Hold, Lost, Cancelled) keep the lead's current stage.
     */
    public static String stageForStatus(String status, String currentStage) {
        if (status == null) {
            return currentStage != null ? currentStage : "New Lead";
        }
        String mapped = STATUS_TO_STAGE.get(status);
        if (mapped != null) {
            return mapped;
        }
        return currentStage != null ? currentStage : "New Lead";
    }
}
