package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A manual deduction an HR/Admin adds against an employee — fine, damage recovery, ad-hoc advance/loan
 * recovery or other. Lifecycle PENDING → APPROVED → APPLIED. An APPROVED deduction is absorbed by the
 * next hourly payroll run for its target period (or the run's period if none), then linked to that
 * payslip via {@code appliedSalaryRecordId} so it is never taken twice.
 */
@Getter
@Setter
@Entity
@Table(name = "employee_deductions", indexes = {
        @Index(name = "idx_empded_employee", columnList = "employee_id"),
        @Index(name = "idx_empded_status", columnList = "status")
})
public class EmployeeDeduction extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "workforce", "department"})
    private Employee employee;

    /** FINE, DAMAGE, ADVANCE_RECOVERY, LOAN_RECOVERY, OTHER. */
    @Column(name = "deduction_type", nullable = false, length = 40)
    private String deductionType;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "deduction_date")
    private LocalDate deductionDate;

    /** PENDING, APPROVED, APPLIED. */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User approvedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    /** The payslip that absorbed this deduction (set on payroll run). */
    @Column(name = "applied_salary_record_id")
    private Long appliedSalaryRecordId;

    /** Optional period this deduction should be applied in (else the next run's period). */
    @Column(name = "target_month")
    private Integer targetMonth;

    @Column(name = "target_year")
    private Integer targetYear;
}
