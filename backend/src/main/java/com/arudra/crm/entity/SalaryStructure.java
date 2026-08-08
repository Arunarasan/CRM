package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Per-employee earning components + statutory flags a payroll run reads. One active row per employee
 * (older revisions kept with active=false / a later effectiveFrom).
 */
@Getter
@Setter
@Entity
@Table(name = "salary_structures", indexes = {
    @Index(name = "idx_salstruct_employee", columnList = "employee_id")
})
public class SalaryStructure extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "workforce", "department"})
    private Employee employee;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal basic = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal hra = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal allowances = BigDecimal.ZERO;

    @Column(name = "special_allowance", nullable = false, precision = 15, scale = 2)
    private BigDecimal specialAllowance = BigDecimal.ZERO;

    @Column(name = "pf_enabled", nullable = false)
    private Boolean pfEnabled = true;

    @Column(name = "pf_percentage", nullable = false, precision = 5, scale = 2)
    private BigDecimal pfPercentage = BigDecimal.valueOf(12);

    @Column(name = "esi_enabled", nullable = false)
    private Boolean esiEnabled = false;

    @Column(name = "professional_tax", nullable = false, precision = 15, scale = 2)
    private BigDecimal professionalTax = BigDecimal.ZERO;

    @Column(name = "overtime_hourly_rate", nullable = false, precision = 10, scale = 2)
    private BigDecimal overtimeHourlyRate = BigDecimal.ZERO;

    @Column(name = "effective_from")
    private LocalDate effectiveFrom;

    @Column(nullable = false)
    private Boolean active = true;
}
