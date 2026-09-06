package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A company-level cash movement that no other module records: "other income" (interest, scrap or
 * asset sale, misc receipts) and company overhead / "other charges" (rent, utilities, marketing,
 * office…). These, together with the customer / supplier / contractor / payroll payments already
 * held elsewhere, are consolidated by the Finance Cash Book. Rows are cash events on {@code txnDate}.
 */
@Getter
@Setter
@Entity
@Table(name = "company_transactions", indexes = {
    @Index(name = "idx_ctxn_direction", columnList = "direction"),
    @Index(name = "idx_ctxn_date", columnList = "txn_date"),
    @Index(name = "idx_ctxn_category", columnList = "category"),
    @Index(name = "idx_ctxn_project", columnList = "project_id")
})
public class CompanyTransaction extends BaseEntity {

    @Column(name = "txn_number", nullable = false, length = 50, unique = true)
    private String txnNumber;

    /** INCOME or EXPENSE. */
    @Column(nullable = false, length = 10)
    private String direction;

    /** RENT, UTILITIES, MARKETING, INTEREST, SCRAP_SALE, MISC… */
    @Column(nullable = false, length = 40)
    private String category;

    /** SUPPLIER, EMPLOYEE, CONTRACTOR, CUSTOMER, OTHER — free classification of the payee/payer. */
    @Column(name = "party_type", length = 30)
    private String partyType;

    @Column(name = "party_name", length = 200)
    private String partyName;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "txn_date", nullable = false)
    private LocalDate txnDate;

    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    /** Optional project attribution; most overhead is company-level and leaves this null. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @Column(length = 500)
    private String description;

    /** Set when this row is a payment of a recurring expense head (rent, electricity…). */
    @Column(name = "recurring_expense_id")
    private Long recurringExpenseId;

    /** Uploaded bill / receipt for this expense. */
    @Column(name = "document_url", length = 500)
    private String documentUrl;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "refreshTokens", "password"})
    private User recordedBy;
}
