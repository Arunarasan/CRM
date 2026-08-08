package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "customer_payments", indexes = {
    @Index(name = "idx_cp_payment_date", columnList = "payment_date"),
    @Index(name = "idx_cp_customer", columnList = "customer_id")
})
public class CustomerPayment extends BaseEntity {

    @Column(name = "payment_number", nullable = false, unique = true, length = 50)
    private String paymentNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "addresses", "documents", "notes", "contactPersons", "tags"})
    private Customer customer;

    // Optional: Can be an advance payment not tied to a specific invoice yet
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "project", "quotation", "boq", "paymentSchedule"})
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    /** ADVANCE, STAGE, MILESTONE, PARTIAL, FULL, RETENTION */
    @Column(name = "payment_type", nullable = false, length = 20)
    private String paymentType = "PARTIAL";

    @Column(name = "payment_stage", length = 50)
    private String paymentStage;

    /** Field-collected payments arrive PENDING_APPROVAL; only CONFIRMED money hits the ledger. */
    @Column(nullable = false, length = 30)
    private String status = "CONFIRMED"; // PENDING_APPROVAL, CONFIRMED, REJECTED

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate = LocalDate.now();

    @Column(name = "payment_method", length = 50)
    private String paymentMethod; // CASH, UPI, BANK_TRANSFER, CHEQUE, CREDIT_CARD, DEBIT_CARD, NEFT, RTGS, IMPS

    @Column(name = "reference_number", length = 100)
    private String referenceNumber; // Txn ID

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collected_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "refreshTokens"})
    private User collectedBy;

    @Column(name = "proof_url", length = 500)
    private String proofUrl;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
