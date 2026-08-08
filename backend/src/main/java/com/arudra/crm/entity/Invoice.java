package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "invoices", indexes = {
    @Index(name = "idx_inv_status", columnList = "status"),
    @Index(name = "idx_inv_due_date", columnList = "due_date"),
    @Index(name = "idx_inv_customer", columnList = "customer_id"),
    @Index(name = "idx_inv_project", columnList = "project_id")
})
public class Invoice extends BaseEntity {

    @Column(name = "invoice_number", nullable = false, unique = true, length = 50)
    private String invoiceNumber;

    /** QUOTATION, ADVANCE, PROGRESS, FINAL, PROFORMA */
    @Column(name = "invoice_type", nullable = false, length = 30)
    private String invoiceType = "PROGRESS";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "addresses", "documents", "notes", "contactPersons", "tags"})
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "project", "boq", "measurement", "items", "labours", "taxes", "discounts", "additionalCharges", "terms", "approvals", "negotiations", "attachments", "activities"})
    private Quotation quotation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "quotation", "lead", "customer", "phases", "items"})
    private Boq boq;

    /** The stage-plan row this invoice bills, when generated from a payment schedule. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_schedule_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "invoice"})
    private PaymentSchedule paymentSchedule;

    /** QUOTATION_ADVANCE, DESIGN_APPROVAL, MATERIAL_PURCHASE, WORK_STARTED, COMPLETION_50, COMPLETION_75, PROJECT_COMPLETION, FINAL_SETTLEMENT */
    @Column(name = "payment_stage", length = 50)
    private String paymentStage;

    @Column(nullable = false)
    private LocalDate date = LocalDate.now();

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "sub_total", precision = 15, scale = 2)
    private BigDecimal subTotal = BigDecimal.ZERO;

    /** PERCENTAGE or FLAT; discountValue is the entered figure, discountAmount the money effect. */
    @Column(name = "discount_type", length = 20)
    private String discountType;

    @Column(name = "discount_value", precision = 15, scale = 2)
    private BigDecimal discountValue;

    @Column(name = "discount_amount", precision = 15, scale = 2, nullable = false)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    /** CGST_SGST for intra-state supply, IGST for inter-state. */
    @Column(name = "gst_type", nullable = false, length = 10)
    private String gstType = "CGST_SGST";

    @Column(name = "gst_amount", precision = 15, scale = 2)
    private BigDecimal gstAmount = BigDecimal.ZERO;

    @Column(name = "cgst_amount", precision = 15, scale = 2, nullable = false)
    private BigDecimal cgstAmount = BigDecimal.ZERO;

    @Column(name = "sgst_amount", precision = 15, scale = 2, nullable = false)
    private BigDecimal sgstAmount = BigDecimal.ZERO;

    @Column(name = "igst_amount", precision = 15, scale = 2, nullable = false)
    private BigDecimal igstAmount = BigDecimal.ZERO;

    @Column(name = "round_off", precision = 6, scale = 2, nullable = false)
    private BigDecimal roundOff = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "amount_paid", precision = 15, scale = 2, nullable = false)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(name = "balance_due", precision = 15, scale = 2)
    private BigDecimal balanceDue;

    @Column(name = "retention_percent", precision = 5, scale = 2)
    private BigDecimal retentionPercent;

    @Column(name = "retention_amount", precision = 15, scale = 2, nullable = false)
    private BigDecimal retentionAmount = BigDecimal.ZERO;

    @Column(name = "place_of_supply", length = 100)
    private String placeOfSupply;

    // Legacy statuses DRAFT/SENT/PARTIAL/PAID/CANCELLED remain valid; the finance
    // module adds GENERATED and OVERDUE (PARTIAL is surfaced as "Partially Paid").
    @Column(nullable = false, length = 50)
    private String status = "DRAFT"; // DRAFT, GENERATED, SENT, PARTIAL, PAID, OVERDUE, CANCELLED

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "cancelled_reason", columnDefinition = "TEXT")
    private String cancelledReason;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(columnDefinition = "TEXT")
    private String terms;
}
