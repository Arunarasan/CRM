package com.arudra.crm.dto.customer360;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CustomerProjectSummaryDTO {
    private long totalProjects;
    private long runningProjects;
    private long completedProjects;
    private long cancelledProjects;
    private BigDecimal totalBudget;
    private BigDecimal totalSpent;
    private LocalDate lastProjectDate;
}
