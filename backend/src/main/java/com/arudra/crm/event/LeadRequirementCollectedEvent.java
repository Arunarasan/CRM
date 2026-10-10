package com.arudra.crm.event;

/**
 * Published when the office has done a lead's requirement work itself — edited the requirement on the
 * lead, booked a site visit, saved a measurement or created a quotation. EmployeeTaskService listens
 * and closes the lead's open "Collect Requirement" task(s) so the workflow moves on to the next task.
 */
public class LeadRequirementCollectedEvent {
    private final Long leadId;
    private final Long byUserId; // who did the work (null = system / backfill)
    private final String reason; // e.g. "requirement updated", "site visit booked"
    private final boolean notify;
    private final boolean leadConverted; // the lead became a project → close EVERY open lead task

    public LeadRequirementCollectedEvent(Long leadId, Long byUserId, String reason) {
        this(leadId, byUserId, reason, true);
    }

    public LeadRequirementCollectedEvent(Long leadId, Long byUserId, String reason, boolean notify) {
        this(leadId, byUserId, reason, notify, false);
    }

    public LeadRequirementCollectedEvent(Long leadId, Long byUserId, String reason, boolean notify, boolean leadConverted) {
        this.leadId = leadId;
        this.byUserId = byUserId;
        this.reason = reason;
        this.notify = notify;
        this.leadConverted = leadConverted;
    }

    /** The lead was converted to a project — every open lead-workflow task closes, whoever holds it. */
    public static LeadRequirementCollectedEvent converted(Long leadId, Long byUserId, boolean notify) {
        return new LeadRequirementCollectedEvent(leadId, byUserId, "lead converted to a project", notify, true);
    }

    public Long getLeadId() { return leadId; }
    public Long getByUserId() { return byUserId; }
    public String getReason() { return reason; }
    public boolean isNotify() { return notify; }
    public boolean isLeadConverted() { return leadConverted; }
}
