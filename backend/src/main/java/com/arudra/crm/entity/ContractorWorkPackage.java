package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A discrete slice of project execution handed to one or more contractors
 * (e.g. "Ground Floor Carpentry", "Bedroom Wardrobe Installation").
 *
 * <p>This is the ONLY way contractor work enters the system — a project is never assigned
 * wholesale. The package is anchored to a {@link Project} and optionally narrowed to a
 * {@link ProjectPhase}, a {@link ProjectRoom} and a set of BOQ items via {@link WorkPackageItem}.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_work_packages", indexes = {
    @Index(name = "idx_wp_project", columnList = "project_id"),
    @Index(name = "idx_wp_status", columnList = "status"),
    @Index(name = "idx_wp_trade", columnList = "trade"),
    @Index(name = "idx_wp_phase", columnList = "phase_id")
})
public class ContractorWorkPackage extends BaseEntity {

    @Column(name = "package_code", unique = true, length = 50)
    private String packageCode;

    @NotBlank
    @Column(name = "package_name", nullable = false, length = 255)
    private String packageName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation",
            "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project"})
    private ProjectPhase phase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "phase", "items"})
    private ProjectRoom room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "quotation", "measurement", "items", "phases"})
    private Boq boq;

    /** CARPENTRY, ALUMINIUM, GLASS, PAINTING, ELECTRICAL, PLUMBING, FALSE_CEILING, ... */
    @Column(length = 50)
    private String trade;

    @Column(nullable = false, length = 40)
    private String status = "DRAFT";
    // DRAFT, PENDING_ASSIGNMENT, ASSIGNED, ACCEPTED, IN_PROGRESS, ON_HOLD,
    // WORK_COMPLETED, INSPECTION_PENDING, REWORK, COMPLETED, CANCELLED

    @Column(nullable = false, length = 20)
    private String priority = "MEDIUM"; // LOW, MEDIUM, HIGH, URGENT

    /** PER_DAY, PER_SQFT, PER_RUNNING_FEET, PER_UNIT, FIXED_CONTRACT, MILESTONE_BASED. */
    @Column(name = "rate_type", nullable = false, length = 30)
    private String rateType = "FIXED_CONTRACT";

    @Column(precision = 15, scale = 2)
    private BigDecimal rate;

    @Column(precision = 15, scale = 2)
    private BigDecimal quantity;

    @Column(length = 20)
    private String unit;

    @Column(name = "estimated_cost", nullable = false, precision = 15, scale = 2)
    private BigDecimal estimatedCost = BigDecimal.ZERO;

    /** Sum of the agreed amounts across accepted assignments — the committed contractor cost. */
    @Column(name = "approved_cost", nullable = false, precision = 15, scale = 2)
    private BigDecimal approvedCost = BigDecimal.ZERO;

    @Column(name = "actual_cost", nullable = false, precision = 15, scale = 2)
    private BigDecimal actualCost = BigDecimal.ZERO;

    @Column(name = "billed_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal billedAmount = BigDecimal.ZERO;

    @Column(name = "paid_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(name = "retention_percentage", precision = 5, scale = 2)
    private BigDecimal retentionPercentage;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "actual_start_date")
    private LocalDate actualStartDate;

    @Column(name = "actual_end_date")
    private LocalDate actualEndDate;

    @Column(name = "completion_percentage", nullable = false)
    private Integer completionPercentage = 0;

    /** Latest inspection outcome: PASS, FAIL, REWORK, APPROVED. */
    @Column(name = "quality_status", length = 30)
    private String qualityStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_engineer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User siteEngineer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User createdByUser;

    /** Plain id, no FK — traceability to the BoqPhase this package was generated from. */
    @Column(name = "source_boq_phase_id")
    private Long sourceBoqPhaseId;

    /**
     * Idempotency key for "generate work packages from BOQ": the phase+room+trade bucket
     * this package represents. Re-running the generator updates the existing package
     * instead of creating a duplicate.
     */
    @Column(name = "source_trade_key", length = 100)
    private String sourceTradeKey;

    @Column(name = "scope_of_work", columnDefinition = "TEXT")
    private String scopeOfWork;

    @Column(columnDefinition = "TEXT")
    private String terms;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    /** Computed, not persisted: billed - paid. */
    @Transient
    public BigDecimal getOutstandingAmount() {
        BigDecimal billed = billedAmount == null ? BigDecimal.ZERO : billedAmount;
        BigDecimal paid = paidAmount == null ? BigDecimal.ZERO : paidAmount;
        return billed.subtract(paid);
    }

    /** Computed, not persisted: past end date and not yet completed. */
    @Transient
    public boolean isDelayed() {
        if (endDate == null) return false;
        if ("COMPLETED".equals(status) || "CANCELLED".equals(status)) return false;
        return endDate.isBefore(LocalDate.now());
    }
}
