package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Immutable audit row: one advance/loan recovery deduction applied on a specific payslip. Lets the
 * profile show exactly which advance/loan a payroll paid down, and supports reversal if a run is cancelled.
 */
@Getter
@Setter
@Entity
@Table(name = "payroll_recoveries", indexes = {
    @Index(name = "idx_payrec_salary", columnList = "salary_record_id"),
    @Index(name = "idx_payrec_source", columnList = "source_type,source_id")
})
public class PayrollRecovery extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "salary_record_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "employee"})
    private SalaryRecord salaryRecord;

    /** ADVANCE, LOAN. */
    @Column(name = "source_type", nullable = false, length = 20)
    private String sourceType;

    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;
}
