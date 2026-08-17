package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "projects", indexes = {
    @Index(name = "idx_project_status", columnList = "status"),
    @Index(name = "idx_project_customer", columnList = "customer_id"),
    @Index(name = "idx_project_code", columnList = "project_code")
})
public class Project extends BaseEntity {

    @Column(name = "project_code", unique = true, length = 50)
    private String projectCode;

    @NotBlank
    @Column(name = "project_name", nullable = false, length = 255)
    private String projectName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "convertedToProject", "convertedToCustomer"})
    private Lead lead;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "boq", "measurement"})
    private Quotation quotation;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_visit_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project"})
    private SiteVisit siteVisit;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "boq", "quotation"})
    private Measurement measurement;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "quotation", "measurement"})
    private Boq boq;

    @Column(name = "property_address", columnDefinition = "TEXT")
    private String propertyAddress;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_manager_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User projectManager;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_executive_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User salesExecutive;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "designer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User designer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_engineer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User siteEngineer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supervisor_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User supervisor;

    @Column(name = "project_type", length = 100)
    private String projectType; // Residential, Commercial, Office, etc.

    @Column(name = "priority", length = 50)
    private String priority = "MEDIUM"; // LOW, MEDIUM, HIGH, URGENT

    @Column(name = "project_category", length = 100)
    private String projectCategory;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "expected_completion_date")
    private LocalDate endDate; // Using endDate to map to expected completion

    @Column(name = "actual_completion_date")
    private LocalDate actualCompletionDate;

    /** Days from startDate to actualCompletionDate, set automatically when the project auto-completes. */
    @Column(name = "total_duration_days")
    private Integer totalDurationDays;

    @Column(name = "warranty_end_date")
    private LocalDate warrantyEndDate;

    @NotBlank
    @Column(nullable = false, length = 50)
    private String status; // PLANNING, PENDING, APPROVED, RUNNING, PAUSED, ON_HOLD, COMPLETED, CANCELLED, CLOSED

    @Column(nullable = false)
    private Integer progress = 0; // percentage

    /** When true, crossing a payment stage's trigger_percentage auto-raises that stage's invoice. */
    @Column(name = "auto_billing_enabled", nullable = false)
    private boolean autoBillingEnabled = true;

    /** One-shot guard so the "fully completed & fully paid" alert is dispatched only once. */
    @Column(name = "settlement_notified", nullable = false)
    private boolean settlementNotified = false;

    @Column(precision = 15, scale = 2)
    private java.math.BigDecimal budget;

    @Column(name = "spent_amount", precision = 15, scale = 2)
    private java.math.BigDecimal spentAmount = java.math.BigDecimal.ZERO;

    @Column(name = "estimated_cost", precision = 15, scale = 2)
    private java.math.BigDecimal estimatedCost;

    @Column(name = "actual_cost", precision = 15, scale = 2)
    private java.math.BigDecimal actualCost;

    /** Computed, not persisted: budget - actualCost (falls back to spentAmount if actualCost isn't set yet). */
    @Transient
    public java.math.BigDecimal getProfit() {
        if (budget == null) return null;
        java.math.BigDecimal cost = actualCost != null ? actualCost : spentAmount;
        if (cost == null) return null;
        return budget.subtract(cost);
    }

    @Column(columnDefinition = "TEXT")
    private String projectDescription;

    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(name = "customer_notes", columnDefinition = "TEXT")
    private String customerNotes;

    @Column(name = "project_notes", columnDefinition = "TEXT")
    private String projectNotes;

    @Column(name = "completion_certificate_base64", columnDefinition = "TEXT")
    private String completionCertificateBase64;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "project_employees",
            joinColumns = @JoinColumn(name = "project_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> assignedEmployees = new HashSet<>();
}
