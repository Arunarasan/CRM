package com.arudra.crm.dto.sitevisit;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SiteVisitDashboardDTO {
    private long todaysVisits;
    private long upcomingVisits;
    private long completedVisits;
    private long cancelledVisits;
    private long overdueVisits;
    private double averageVisitDurationMinutes;
    private String mostActiveEmployeeName;
    private long visitsThisMonth;
}
