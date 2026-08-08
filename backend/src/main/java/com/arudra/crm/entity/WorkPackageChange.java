package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A variation to a contractor's agreed scope — usually the downstream effect of a
 * {@link ProjectChangeRequest} on the BOQ. Approving it adjusts the package's approved cost
 * and end date so billing stays reconciled with what was actually authorised.
 */
@Getter
@Setter
@Entity
@Table(name = "work_package_changes", indexes = {
    @Index(name = "idx_wpc_package", columnList = "work_package_id"),
    @Index(name = "idx_wpc_status", columnList = "status")
})
public class WorkPackageChange extends BaseEntity {

    @Column(name = "change_number", unique = true, length = 50)
    private String changeNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "phase", "room", "boq"})
    private ContractorWorkPackage workPackage;

    /** Plain id, no FK constraint — the project change request that triggered this variation. */
    @Column(name = "project_change_request_id")
    private Long projectChangeRequestId;

    @Column(name = "change_type", nullable = false, length = 30)
    private String changeType; // ADDITIONAL_WORK, REDUCED_SCOPE, RATE_REVISION, TIME_EXTENSION

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String reason;

    /** Signed: positive for extra work, negative for reduced scope. */
    @Column(name = "cost_impact", nullable = false, precision = 15, scale = 2)
    private BigDecimal costImpact = BigDecimal.ZERO;

    @Column(name = "quantity_impact", precision = 15, scale = 2)
    private BigDecimal quantityImpact;

    @Column(name = "days_extension")
    private Integer daysExtension;

    @Column(name = "revised_end_date")
    private LocalDate revisedEndDate;

    @Column(nullable = false, length = 30)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;
}
