package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * An admin-editable named line on a payslip — an extra earning (lead/project task-completion
 * incentive, customer-feedback incentive, company incentive, allowance, ad-hoc bonus) or a deduction.
 * Added on top of the auto-computed payslip; gross/net recompute to include these.
 */
@Getter
@Setter
@Entity
@Table(name = "payslip_line_items", indexes = {
    @Index(name = "idx_payslip_line_salary", columnList = "salary_record_id")
})
public class PayslipLineItem extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "salary_record_id", nullable = false)
    private SalaryRecord salaryRecord;

    @Column(nullable = false, length = 20)
    private String category; // EARNING | DEDUCTION

    @Column(nullable = false, length = 150)
    private String label;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(nullable = false, length = 20)
    private String source = "MANUAL"; // MANUAL | AUTO
}
