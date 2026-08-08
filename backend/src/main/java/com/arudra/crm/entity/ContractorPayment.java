package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Money paid to a contractor. Advances stand alone; every other payment settles a
 * {@link ContractorBill} that has cleared the Engineer → PM → Finance approval chain.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_payments", indexes = {
    @Index(name = "idx_ctp_contractor", columnList = "contractor_id"),
    @Index(name = "idx_ctp_status", columnList = "status")
})
public class ContractorPayment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    /** Optional project link so contractor labour cost rolls up into project expenses. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    /** Null for an advance; set once the payment settles an approved bill. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_bill_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "workPackage", "contractor"})
    private ContractorBill bill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "phase", "room", "boq"})
    private ContractorWorkPackage workPackage;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "payment_date")
    private LocalDate paymentDate;

    @Column(nullable = false, length = 50)
    private String status = "PENDING"; // PENDING, PAID, OVERDUE

    @Column(name = "payment_type", nullable = false, length = 30)
    private String paymentType = "RUNNING_BILL"; // ADVANCE, RUNNING_BILL, FINAL_BILL, RETENTION_RELEASE

    @Column(name = "payment_mode", length = 30)
    private String paymentMode; // CASH, BANK_TRANSFER, CHEQUE, UPI, NEFT, RTGS

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    @Column(name = "transaction_reference", length = 150)
    private String transactionReference;

    @Column(name = "tds_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal tdsAmount = BigDecimal.ZERO;

    @Column(name = "invoice_url", length = 500)
    private String invoiceUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "paid_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User paidBy;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
