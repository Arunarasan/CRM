package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A customer-driven scope/budget change on a Project (e.g. "drop First Floor", "add Kitchen back").
 * Distinct from a PM's day-to-day direct BOQ edits: this carries a requested/approved/rejected/completed
 * workflow, and approving it applies its {@link ProjectChangeRequestPhase} lines as one new BOQ revision
 * plus the full task/inventory/quotation cascade.
 */
@Getter
@Setter
@Entity
@Table(name = "project_change_requests", indexes = {
    @Index(name = "idx_pcr_project", columnList = "project_id")
})
public class ProjectChangeRequest extends BaseEntity {

    @Column(name = "request_number", unique = true, length = 50)
    private String requestNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User approvedBy;

    @Column(name = "request_date")
    private LocalDate requestDate = LocalDate.now();

    @Column(columnDefinition = "TEXT")
    private String reason;

    @NotBlank
    @Column(name = "change_type", nullable = false, length = 50)
    private String changeType;
    // CUSTOMER_REQUEST, SITE_CONDITION, MEASUREMENT_CHANGE, MATERIAL_CHANGE, BUDGET_REDUCTION,
    // BUDGET_INCREASE, DESIGN_REVISION, ENGINEER_SUGGESTION

    @Column(nullable = false, length = 50)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED, COMPLETED

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "approval_date")
    private LocalDateTime approvalDate;

    @Column(name = "completed_date")
    private LocalDateTime completedDate;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    /** Plain id, no FK constraint — the new BOQ revision this change request produced once applied. */
    @Column(name = "resulting_boq_id")
    private Long resultingBoqId;

    /** Plain id, no FK constraint — the new quotation revision generated once applied. */
    @Column(name = "resulting_quotation_id")
    private Long resultingQuotationId;
}
