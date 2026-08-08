package com.arudra.crm.dto.boq;

import lombok.Data;

import java.math.BigDecimal;

/** Card metrics for the BOQ dashboard. */
@Data
public class BoqDashboardDTO {
    private long totalBoqs;
    private long draft;
    private long pendingReview;
    private long approved;
    private long rejected;
    private BigDecimal totalBoqValue;

    private long approvedQuotations;
    private long pendingQuotations;
    private long partialQuotations;
    private long revisionCount;
    private BigDecimal approvedValue;
    private BigDecimal pendingValue;
}
