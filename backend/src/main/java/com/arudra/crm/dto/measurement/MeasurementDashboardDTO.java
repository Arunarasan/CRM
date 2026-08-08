package com.arudra.crm.dto.measurement;

import lombok.Data;

/** Card metrics for the measurement dashboard. */
@Data
public class MeasurementDashboardDTO {
    private long todaysMeasurements;
    private long pending;          // Draft / Assigned / Accepted / In Progress
    private long underReview;
    private long completed;
    private long approved;
    private long revisionRequests;
    private long measurementsThisMonth;
    /** Average hours between start and completion for measurements completed this month. */
    private Double averageCompletionHours;
    private String mostActiveEngineer;
    private long mostActiveEngineerCount;
}
