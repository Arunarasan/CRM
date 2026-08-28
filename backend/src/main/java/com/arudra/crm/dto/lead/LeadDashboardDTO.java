package com.arudra.crm.dto.lead;

import lombok.Data;

/**
 * KPI card metrics for the lead dashboard. Field names newLeads, todaysFollowups,
 * pendingFollowups, qualifiedLeads, wonLeads, lostLeads and conversionRate are kept
 * for backward compatibility with the pre-existing (previously mocked) endpoint.
 */
@Data
public class LeadDashboardDTO {
    private long totalLeads;
    private long todayLeads;
    private long weekLeads;
    private long monthLeads;
    private long hotLeads;
    private long warmLeads;
    private long coldLeads;
    private long convertedLeads;
    private long lostLeads;
    private long pendingFollowups;   // overdue follow-ups
    private long todaysFollowups;
    private long todaySiteVisits;
    private long todayMeasurements;
    private long quotationPending;

    // per-stage tiles (open leads only) surfaced on the lead list
    private long newLeads;
    private long contactedLeads;
    private long interestedLeads;

    // legacy keys still consumed by older clients
    private long qualifiedLeads;     // leads in Interested/Negotiation and beyond
    private long wonLeads;           // = convertedLeads
    private String conversionRate;   // e.g. "25.0%"
}
