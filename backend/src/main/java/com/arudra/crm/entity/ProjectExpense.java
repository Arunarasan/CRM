package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A cost booked against a project. MANUAL rows are user-entered; other sources are
 * auto-synced from their originating document (purchase bill, inventory consumption,
 * contractor payment, salary) with source+referenceId as the idempotency key —
 * re-syncing updates the same row instead of double-counting.
 */
@Getter
@Setter
@Entity
@Table(name = "project_expenses", indexes = {
    @Index(name = "idx_pe_project", columnList = "project_id"),
    @Index(name = "idx_pe_category", columnList = "category"),
    @Index(name = "idx_pe_reference", columnList = "source, reference_id")
})
public class ProjectExpense extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    /** MATERIAL, LABOUR, CONTRACTOR, TRANSPORT, EQUIPMENT, OVERHEAD, MISC */
    @Column(nullable = false, length = 30)
    private String category;

    /** MANUAL, PURCHASE_BILL, INVENTORY_CONSUMPTION, CONTRACTOR_PAYMENT, SALARY */
    @Column(nullable = false, length = 30)
    private String source = "MANUAL";

    @Column(name = "reference_type", length = 30)
    private String referenceType;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(length = 500)
    private String description;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "expense_date", nullable = false)
    private LocalDate expenseDate;

    @Column(length = 200)
    private String vendor;

    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "refreshTokens"})
    private User recordedBy;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
