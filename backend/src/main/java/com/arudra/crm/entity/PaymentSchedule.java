package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One stage/milestone of a project's agreed payment plan; invoiced and paid off individually. */
@Getter
@Setter
@Entity
@Table(name = "payment_schedules", indexes = {
    @Index(name = "idx_ps_project", columnList = "project_id"),
    @Index(name = "idx_ps_status", columnList = "status")
})
public class PaymentSchedule extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    /** QUOTATION_ADVANCE, DESIGN_APPROVAL, MATERIAL_PURCHASE, WORK_STARTED, COMPLETION_50, COMPLETION_75, PROJECT_COMPLETION, FINAL_SETTLEMENT */
    @Column(nullable = false, length = 50)
    private String stage;

    @Column(length = 255)
    private String description;

    /** Percentage of the project value this stage represents (informational). */
    @Column(precision = 5, scale = 2)
    private BigDecimal percentage;

    /**
     * Work-progress % at/above which this stage is auto-invoiced (marked DUE) by the billing
     * automation. NULL = not progress-driven (billed manually or on another event).
     */
    @Column(name = "trigger_percentage", precision = 5, scale = 2)
    private BigDecimal triggerPercentage;

    /** Set once the automation has raised this stage's invoice, so it never double-bills. */
    @Column(name = "auto_triggered", nullable = false)
    private boolean autoTriggered = false;

    @Column(name = "auto_triggered_date")
    private LocalDate autoTriggeredDate;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(nullable = false, length = 30)
    private String status = "PENDING"; // PENDING, INVOICED, PARTIAL, PAID, OVERDUE

    /** Invoice raised for this stage, once generated. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "project", "quotation", "boq", "paymentSchedule"})
    private Invoice invoice;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;
}
