package com.arudra.crm.dto.customer360;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Header + right-sidebar data for the Customer 360 page. Kept intentionally lightweight
 * (no child-entity lists) so it loads fast and can be cached — list-style tabs fetch their
 * own paginated data separately.
 */
@Data
public class CustomerOverviewDTO {
    private Long id;
    private String photoUrl;
    private String name;
    private String customerCode;
    private String customerType;
    private String status;
    private String companyName;
    private String phone;
    private String whatsappNumber;
    private String email;

    private Long assignedEmployeeId;
    private String assignedEmployeeName;

    private LocalDateTime createdAt;
    private LocalDate customerSince;
    private LocalDateTime updatedAt;

    // --- Right sidebar ---
    /** 0-100 deterministic heuristic. See Customer360Service#computeHealthScore. */
    private Integer healthScore;
    /** 1-5, derived from healthScore. */
    private Integer rating;
    /** Not tracked yet — no lead-scoring model exists in this codebase. Future enhancement. */
    private Integer leadScore;
    /** Not tracked yet — same reason as leadScore. Future enhancement. */
    private Integer probabilityToConvert;
    private BigDecimal outstandingBalance;
    private LocalDate nextFollowUpDate;
    private String nextFollowUpPurpose;
    private LocalDateTime lastCommunicationDate;
    private String lastCommunicationChannel;
    private String assignedSalesPersonName;
    private String assignedProjectManagerName;

    /** Total invoiced (or paid, whichever is the accepted CLV definition) across the relationship. */
    private BigDecimal customerLifetimeValue;
}
