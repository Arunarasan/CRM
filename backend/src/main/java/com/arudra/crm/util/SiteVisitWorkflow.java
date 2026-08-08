package com.arudra.crm.util;

import java.util.Arrays;
import java.util.List;

/**
 * Central definition of the site visit lifecycle: types, statuses, priorities,
 * outcomes, assignment roles and the default checklist. Used by SiteVisitService
 * and exposed to the frontend via /api/site-visits/meta.
 */
public final class SiteVisitWorkflow {

    private SiteVisitWorkflow() {
    }

    public static final List<String> VISIT_TYPES = Arrays.asList(
            "Initial Visit", "Consultation", "Measurement", "Design Discussion",
            "Material Inspection", "Site Inspection", "Installation", "Quality Check",
            "Final Inspection", "Handover", "Service Visit", "Warranty Visit", "Other");

    public static final List<String> STATUSES = Arrays.asList(
            "Scheduled", "Assigned", "Accepted", "In Progress", "Completed",
            "Cancelled", "Rescheduled", "No Response");

    public static final List<String> PRIORITIES = Arrays.asList("Low", "Medium", "High", "Urgent");

    public static final List<String> OUTCOMES = Arrays.asList(
            "Interested", "Need Follow-up", "Measurement Required", "Quotation Required",
            "Quotation Sent", "Project Confirmed", "Project On Hold", "Lost", "Completed");

    public static final List<String> ASSIGNMENT_ROLES = Arrays.asList(
            "Sales Executive", "Interior Designer", "Site Engineer", "Measurement Engineer",
            "Project Manager", "Supervisor", "Technician", "Contractor");

    public static final List<String> ASSIGNMENT_STATUSES = Arrays.asList(
            "Assigned", "Accepted", "Declined");

    public static final List<String> MEDIA_CATEGORIES = Arrays.asList(
            "Before Photo", "During Visit Photo", "After Photo", "Video", "Voice Note",
            "Document", "Floor Plan", "Measurement Drawing");

    /** Statuses that mean the visit is no longer open/active. */
    public static final List<String> CLOSED_STATUSES = Arrays.asList("Completed", "Cancelled");

    public static final List<String> DEFAULT_CHECKLIST_ITEMS = Arrays.asList(
            "Customer Met", "Site Inspected", "Measurements Taken", "Photos Captured",
            "Videos Recorded", "Requirements Discussed", "Budget Discussed", "Design Explained",
            "Quotation Required", "Material Sample Shown", "Next Visit Planned",
            "Customer Signature Collected");
}
