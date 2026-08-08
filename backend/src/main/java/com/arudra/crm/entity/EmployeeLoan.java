package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Employee loan recovered by EMI over subsequent payroll runs. {@code recovered_amount}/{@code balance}
 * are maintained by PayrollService; each recovery is logged as a {@link PayrollRecovery}. Status flips
 * to CLOSED when the balance reaches zero.
 */
@Getter
@Setter
@Entity
@Table(name = "employee_loans", indexes = {
    @Index(name = "idx_emploan_employee", columnList = "employee_id"),
    @Index(name = "idx_emploan_status", columnList = "status")
})
public class EmployeeLoan extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "workforce", "department"})
    private Employee employee;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal principal = BigDecimal.ZERO;

    @Column(name = "emi_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal emiAmount = BigDecimal.ZERO;

    @Column(name = "tenure_months")
    private Integer tenureMonths;

    @Column(name = "disbursed_date")
    private LocalDate disbursedDate;

    /** ACTIVE, CLOSED. */
    @Column(nullable = false, length = 30)
    private String status = "ACTIVE";

    @Column(name = "recovered_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal recoveredAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
