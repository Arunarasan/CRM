package com.arudra.crm.dto.customer360;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Overview dashboard summary cards for the Customer 360 page. */
@Data
public class CustomerDashboardStatsDTO {
    private long totalLeads;
    private long openLeads;
    private long wonLeads;
    private long lostLeads;

    private long siteVisits;
    private long measurements;

    private long quotations;
    private long approvedQuotations;
    private long rejectedQuotations;

    private long projects;
    private long completedProjects;
    private long runningProjects;

    private long tasks;
    private long completedTasks;
    private long pendingTasks;

    private long invoices;
    private BigDecimal paidAmount;
    private BigDecimal pendingAmount;
    private BigDecimal outstandingBalance;

    private long documents;
    private long followUps;

    private LocalDateTime lastCommunication;
    private LocalDate nextFollowUp;

    private BigDecimal customerLifetimeValue;
}
