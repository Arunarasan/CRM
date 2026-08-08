package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One contractor engaged on one {@link ContractorWorkPackage}. A package may carry several
 * assignments (e.g. a lead carpenter plus a polishing sub-vendor), each with its own rate,
 * dates and accept/reject state.
 */
@Getter
@Setter
@Entity
@Table(name = "work_package_assignments", indexes = {
    @Index(name = "idx_wpa_package", columnList = "work_package_id"),
    @Index(name = "idx_wpa_contractor", columnList = "contractor_id"),
    @Index(name = "idx_wpa_status", columnList = "status")
})
public class WorkPackageAssignment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ContractorWorkPackage workPackage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    @Column(nullable = false, length = 30)
    private String status = "ASSIGNED"; // ASSIGNED, ACCEPTED, REJECTED, IN_PROGRESS, COMPLETED, TERMINATED

    /** LEAD, SUPPORT, SPECIALIST — informational when several contractors share a package. */
    @Column(length = 50)
    private String role;

    /** Percentage of the package scope this contractor owns, when work is split. */
    @Column(name = "scope_share", precision = 5, scale = 2)
    private BigDecimal scopeShare;

    @Column(name = "rate_type", length = 30)
    private String rateType;

    @Column(precision = 15, scale = 2)
    private BigDecimal rate;

    @Column(name = "agreed_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal agreedAmount = BigDecimal.ZERO;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Column(name = "rejected_at")
    private LocalDateTime rejectedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User assignedBy;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
