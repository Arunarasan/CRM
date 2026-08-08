package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A contractor's bill for work executed on a package.
 *
 * <p>Money flows: gross (measured work) − material recovery − advance adjustment − penalty
 * − other deductions = taxable; + GST − TDS − retention = net payable.
 * Approval runs Site Engineer → Project Manager → Finance before any payment is allowed.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_bills", indexes = {
    @Index(name = "idx_cb_contractor", columnList = "contractor_id"),
    @Index(name = "idx_cb_project", columnList = "project_id"),
    @Index(name = "idx_cb_status", columnList = "status"),
    @Index(name = "idx_cb_date", columnList = "bill_date")
})
public class ContractorBill extends BaseEntity {

    @Column(name = "bill_number", unique = true, length = 50)
    private String billNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "phase", "room", "boq"})
    private ContractorWorkPackage workPackage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation",
            "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @Column(name = "bill_type", nullable = false, length = 30)
    private String billType = "RUNNING"; // ADVANCE, RUNNING, FINAL

    @Column(name = "bill_date", nullable = false)
    private LocalDate billDate = LocalDate.now();

    @Column(name = "period_from")
    private LocalDate periodFrom;

    @Column(name = "period_to")
    private LocalDate periodTo;

    @Column(name = "contractor_invoice_number", length = 100)
    private String contractorInvoiceNumber;

    @Column(name = "work_completed_percentage")
    private Integer workCompletedPercentage;

    // --- Money ----------------------------------------------------------------
    @Column(name = "gross_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal grossAmount = BigDecimal.ZERO;

    @Column(name = "material_deduction", nullable = false, precision = 15, scale = 2)
    private BigDecimal materialDeduction = BigDecimal.ZERO;

    @Column(name = "advance_adjustment", nullable = false, precision = 15, scale = 2)
    private BigDecimal advanceAdjustment = BigDecimal.ZERO;

    @Column(name = "penalty_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal penaltyAmount = BigDecimal.ZERO;

    @Column(name = "other_deduction", nullable = false, precision = 15, scale = 2)
    private BigDecimal otherDeduction = BigDecimal.ZERO;

    @Column(name = "retention_percentage", precision = 5, scale = 2)
    private BigDecimal retentionPercentage;

    @Column(name = "retention_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal retentionAmount = BigDecimal.ZERO;

    @Column(name = "taxable_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal taxableAmount = BigDecimal.ZERO;

    @Column(name = "gst_percentage", precision = 5, scale = 2)
    private BigDecimal gstPercentage;

    @Column(name = "gst_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal gstAmount = BigDecimal.ZERO;

    @Column(name = "tds_percentage", precision = 5, scale = 2)
    private BigDecimal tdsPercentage;

    @Column(name = "tds_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal tdsAmount = BigDecimal.ZERO;

    @Column(name = "net_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal netAmount = BigDecimal.ZERO;

    @Column(name = "paid_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(name = "balance_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal balanceAmount = BigDecimal.ZERO;

    // --- Workflow -------------------------------------------------------------
    @Column(nullable = false, length = 40)
    private String status = "DRAFT";
    // DRAFT, SUBMITTED, ENGINEER_APPROVED, PM_APPROVED, FINANCE_APPROVED,
    // PARTIALLY_PAID, PAID, REJECTED, CANCELLED

    /** SITE_ENGINEER, PROJECT_MANAGER, FINANCE — whose desk the bill is on right now. */
    @Column(name = "current_approval_stage", length = 30)
    private String currentApprovalStage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitted_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User submittedBy;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "measurement_notes", columnDefinition = "TEXT")
    private String measurementNotes;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "attachment_url", length = 500)
    private String attachmentUrl;
}
