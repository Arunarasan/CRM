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

    public LeadRequirementCollectedEvent(Long leadId, Long byUserId, String reason) {
        this(leadId, byUserId, reason, true);
    }

    public LeadRequirementCollectedEvent(Long leadId, Long byUserId, String reason, boolean notify) {
        this.leadId = leadId;
        this.byUserId = byUserId;
        this.reason = reason;
        this.notify = notify;
    }

    public Long getLeadId() { return leadId; }
    public Long getByUserId() { return byUserId; }
    public String getReason() { return reason; }
    public boolean isNotify() { return notify; }
}
