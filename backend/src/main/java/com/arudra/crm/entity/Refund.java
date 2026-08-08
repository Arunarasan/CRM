package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Money returned to a customer; requires approval before it can be marked paid out. */
@Getter
@Setter
@Entity
@Table(name = "refunds", indexes = {
    @Index(name = "idx_ref_status", columnList = "status")
})
public class Refund extends BaseEntity {

    @Column(name = "refund_number", nullable = false, unique = true, length = 50)
    private String refundNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "addresses", "documents", "notes", "contactPersons", "tags"})
    private Customer customer;

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

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED, PAID

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "refreshTokens"})
    private User requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "refreshTokens"})
    private User approvedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "refund_date")
    private LocalDate refundDate;

    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;
}
