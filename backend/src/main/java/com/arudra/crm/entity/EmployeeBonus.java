package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * An admin-awarded bonus for an employee — project-completion, performance, festival or ad-hoc.
 * Lifecycle PENDING -> APPROVED -> PAID. Surfaces in the employee's self-service salary account.
 */
@Getter
@Setter
@Entity
@Table(name = "employee_bonuses", indexes = {
        @Index(name = "idx_empbonus_employee", columnList = "employee_id"),
        @Index(name = "idx_empbonus_status", columnList = "status")
})
public class EmployeeBonus extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Employee employee;

    /**
     * PROJECT_COMPLETION, QUALITY, PERFORMANCE, TARGET_ACHIEVEMENT, FESTIVAL, ATTENDANCE, MANUAL,
     * INCENTIVE, OTHER. INCENTIVE is surfaced as an incentive (not a bonus) on the payslip.
     */
    @Column(name = "bonus_type", nullable = false, length = 40)
    private String bonusType;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    /** Optional — set for PROJECT_COMPLETION bonuses tied to a specific project. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Project project;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "award_date")
    private LocalDate awardDate;

    /** RECOMMENDED (PM proposal, awaiting HR), PENDING (HR-awarded, awaiting approval), APPROVED, PAID. */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "awarded_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User awardedBy;

    /** Set when a Project Manager recommended the bonus (RECOMMENDED → HR review). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recommended_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User recommendedBy;

    /** The payslip that absorbed this bonus (set when a payroll run includes it) — prevents double count. */
    @Column(name = "paid_salary_record_id")
    private Long paidSalaryRecordId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User approvedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;
}
