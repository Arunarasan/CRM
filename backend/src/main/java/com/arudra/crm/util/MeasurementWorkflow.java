package com.arudra.crm.util;

import java.util.List;
import java.util.Map;

/**
 * Central catalogue of measurement statuses, types and the allowed status
 * transitions, mirroring LeadWorkflow. Statuses are plain strings (not enums)
 * to stay consistent with the rest of the codebase and with legacy rows.
 */
public final class MeasurementWorkflow {

    private MeasurementWorkflow() {
    }

    public static final String DRAFT = "Draft";
    public static final String ASSIGNED = "Assigned";
    public static final String ACCEPTED = "Accepted";
    public static final String IN_PROGRESS = "In Progress";
    public static final String UNDER_REVIEW = "Under Review";
    public static final String APPROVED = "Approved";
    public static final String REVISION_REQUIRED = "Revision Required";
    public static final String COMPLETED = "Completed";
    public static final String CANCELLED = "Cancelled";

    public static final List<String> STATUSES = List.of(DRAFT, ASSIGNED, ACCEPTED, IN_PROGRESS,
            UNDER_REVIEW, APPROVED, REVISION_REQUIRED, COMPLETED, CANCELLED);

    public static final List<String> TYPES = List.of(
            "Initial", "Revision", "Final", "Verification", "Site Recheck");

    public static final List<String> PRIORITIES = List.of("Low", "Medium", "High", "Urgent");

    public static final List<String> ASSIGNMENT_ROLES = List.of(
            "Measurement Engineer", "Interior Designer", "Project Manager", "Supervisor");

    public static final List<String> DRAWING_TYPES = List.of(
            "Floor Plan", "CAD File", "PDF Drawing", "Sketch", "Blueprint", "3D Design",
            "Electrical Layout", "Plumbing Layout", "Furniture Layout", "Ceiling Layout");

    public static final List<String> MEDIA_CATEGORIES = List.of(
            "Before Photo", "Room Photo", "Measurement Photo", "Video", "Voice Note");

    /**
     * Everything that can be measured inside a room. Each type becomes the BOQ item's category on
     * generation (BoqService.createFromMeasurement), so this list is effectively the work catalogue.
     */
    public static final List<String> ITEM_TYPES = List.of(
            // Structural
            "Wall", "Door", "Window", "Column", "Beam", "Ceiling", "Floor", "Partition",
            // Woodwork / joinery
            "Wardrobe", "Cupboard", "Loft", "TV Unit", "Kitchen Cabinet", "Crockery Unit",
            "Shelf", "Storage Unit", "Study Table", "Vanity", "Wall Panelling", "Skirting",
            "False Ceiling",
            // Furnishing / glazing
            "Screen", "Glass Partition", "Mirror", "Curtain / Blind", "Railing",
            // MEP
            "Electrical Point", "Switch", "Socket", "Light", "Fan", "AC Point", "Plumbing Point",
            "Custom");

    public static final List<String> ROOM_TYPES = List.of(
            "Living Room", "Bedroom", "Master Bedroom", "Kitchen", "Bathroom", "Dining Room",
            "Study", "Balcony", "Utility", "Pooja Room", "Foyer", "Terrace", "Office", "Other");

    /**
     * Standard floor labels. Free text used to be allowed, which meant "1"/"G"/"Ground" all
     * described the same floor and BOQ items (BoqItem.floorName) grouped inconsistently.
     */
    public static final List<String> FLOOR_LEVELS = List.of(
            "Basement", "Stilt", "Ground Floor", "First Floor", "Second Floor", "Third Floor",
            "Fourth Floor", "Fifth Floor", "Terrace", "Common Area");

    public static final List<String> CHECKLIST_ITEMS = List.of(
            "Site Verified", "Measurements Taken", "Drawings Uploaded", "Photos Uploaded",
            "Customer Signature", "Engineer Signature", "Designer Reviewed", "Approved");

    /** Legacy statuses that pre-date the enterprise workflow map onto new ones for transition checks. */
    private static final Map<String, String> LEGACY_STATUS_ALIASES = Map.of(
            "Rejected", REVISION_REQUIRED);

    private static final Map<String, List<String>> ALLOWED_TRANSITIONS = Map.of(
            DRAFT, List.of(ASSIGNED, IN_PROGRESS, CANCELLED),
            ASSIGNED, List.of(ACCEPTED, IN_PROGRESS, CANCELLED),
            ACCEPTED, List.of(IN_PROGRESS, CANCELLED),
            IN_PROGRESS, List.of(UNDER_REVIEW, CANCELLED),
            UNDER_REVIEW, List.of(APPROVED, REVISION_REQUIRED, CANCELLED),
            APPROVED, List.of(COMPLETED, REVISION_REQUIRED),
            REVISION_REQUIRED, List.of(IN_PROGRESS, UNDER_REVIEW, CANCELLED),
            COMPLETED, List.of(),
            CANCELLED, List.of());

    public static void validateTransition(String from, String to) {
        if (from == null || from.equals(to)) {
            return;
        }
        String effectiveFrom = LEGACY_STATUS_ALIASES.getOrDefault(from, from);
        List<String> allowed = ALLOWED_TRANSITIONS.get(effectiveFrom);
        if (allowed == null) {
            // Unknown legacy status (e.g. old free-text values) — allow any move into the new workflow.
            return;
        }
        if (!allowed.contains(to)) {
            throw new IllegalStateException(
                    "Invalid status transition: '" + from + "' → '" + to + "'. Allowed: " + allowed);
        }
    }
}
