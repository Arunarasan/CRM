package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Salary advance paid to an employee, recovered over subsequent payroll runs by {@code monthlyRecovery}
 * until {@code balance} reaches zero. {@code recovered_amount}/{@code balance} are maintained by
 * PayrollService — never overwrite history, each recovery is also logged as a {@link PayrollRecovery}.
 */
@Getter
@Setter
@Entity
@Table(name = "employee_advances", indexes = {
    @Index(name = "idx_empadv_employee", columnList = "employee_id"),
    @Index(name = "idx_empadv_status", columnList = "status")
})
public class EmployeeAdvance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "workforce", "department"})
    private Employee employee;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(length = 255)
    private String reason;

    @Column(name = "advance_date")
    private LocalDate advanceDate;

    /** PENDING, APPROVED, RECOVERING, RECOVERED, REJECTED. */
    @Column(nullable = false, length = 30)
    private String status = "PENDING";

    @Column(name = "monthly_recovery", nullable = false, precision = 15, scale = 2)
    private BigDecimal monthlyRecovery = BigDecimal.ZERO;

    @Column(name = "recovered_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal recoveredAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal balance = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User approvedBy;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
