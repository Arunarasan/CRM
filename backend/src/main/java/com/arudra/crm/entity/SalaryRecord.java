package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "salary_records")
public class SalaryRecord extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(nullable = false)
    private Integer month; // 1-12

    @Column(nullable = false)
    private Integer year;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal basic;

    @Column(precision = 15, scale = 2)
    private BigDecimal allowances = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2)
    private BigDecimal deductions = BigDecimal.ZERO;

    @Column(name = "net_salary", precision = 15, scale = 2, nullable = false)
    private BigDecimal netSalary;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, PAID

    @Column(name = "payment_date")
    private LocalDate paymentDate;

    // --- Payslip breakdown (V19) — earnings ----------------------------------
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal hra = BigDecimal.ZERO;

    @Column(name = "overtime_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal overtimeAmount = BigDecimal.ZERO;

    @Column(name = "overtime_hours", nullable = false, precision = 8, scale = 2)
    private BigDecimal overtimeHours = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal bonus = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal incentive = BigDecimal.ZERO;

    @Column(name = "other_earnings", nullable = false, precision = 15, scale = 2)
    private BigDecimal otherEarnings = BigDecimal.ZERO;

    @Column(name = "gross_earnings", nullable = false, precision = 15, scale = 2)
    private BigDecimal grossEarnings = BigDecimal.ZERO;

    // --- Payslip breakdown — deductions --------------------------------------
    @Column(name = "pf_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal pfAmount = BigDecimal.ZERO;

    @Column(name = "esi_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal esiAmount = BigDecimal.ZERO;

    @Column(name = "professional_tax", nullable = false, precision = 15, scale = 2)
    private BigDecimal professionalTax = BigDecimal.ZERO;

    @Column(name = "advance_recovery", nullable = false, precision = 15, scale = 2)
    private BigDecimal advanceRecovery = BigDecimal.ZERO;

    @Column(name = "loan_recovery", nullable = false, precision = 15, scale = 2)
    private BigDecimal loanRecovery = BigDecimal.ZERO;

    @Column(name = "leave_deduction", nullable = false, precision = 15, scale = 2)
    private BigDecimal leaveDeduction = BigDecimal.ZERO;

    @Column(name = "other_deductions", nullable = false, precision = 15, scale = 2)
    private BigDecimal otherDeductions = BigDecimal.ZERO;

    @Column(name = "total_deductions", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalDeductions = BigDecimal.ZERO;

    // --- Attendance-driven counters ------------------------------------------
    @Column(name = "working_days", precision = 6, scale = 2)
    private BigDecimal workingDays;

    @Column(name = "paid_days", precision = 6, scale = 2)
    private BigDecimal paidDays;

    @Column(name = "lop_days", precision = 6, scale = 2)
    private BigDecimal lopDays;

    @Column(name = "payslip_number", length = 50)
    private String payslipNumber;

    @Column(name = "generated_at")
    private java.time.LocalDateTime generatedAt;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    // --- Hourly payslip breakdown (V25) --------------------------------------
    /** MONTHLY (legacy fixed-salary run) or HOURLY (attendance-driven run). */
    @Column(name = "pay_type", nullable = false, length = 20)
    private String payType = "MONTHLY";

    @Column(name = "hourly_rate", precision = 10, scale = 2)
    private BigDecimal hourlyRate;

    @Column(name = "overtime_rate", precision = 10, scale = 2)
    private BigDecimal overtimeRate;

    @Column(name = "worked_hours", nullable = false, precision = 8, scale = 2)
    private BigDecimal workedHours = BigDecimal.ZERO;

    @Column(name = "regular_hours", nullable = false, precision = 8, scale = 2)
    private BigDecimal regularHours = BigDecimal.ZERO;

    @Column(name = "attendance_days", nullable = false)
    private Integer attendanceDays = 0;

    @Column(name = "regular_earnings", nullable = false, precision = 15, scale = 2)
    private BigDecimal regularEarnings = BigDecimal.ZERO;

    @Column(name = "project_bonus", nullable = false, precision = 15, scale = 2)
    private BigDecimal projectBonus = BigDecimal.ZERO;

    @Column(name = "manual_bonus", nullable = false, precision = 15, scale = 2)
    private BigDecimal manualBonus = BigDecimal.ZERO;

    @Column(name = "manual_deduction", nullable = false, precision = 15, scale = 2)
    private BigDecimal manualDeduction = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User approvedBy;

    @Column(name = "approved_at")
    private java.time.LocalDateTime approvedAt;
}
