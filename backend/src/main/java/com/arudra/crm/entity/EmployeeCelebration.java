package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One "gift" card in the employee portal: money was given (bonus, incentive, allowance or salary). */
@Getter
@Setter
@Entity
@Table(name = "employee_celebrations", indexes = {
        @Index(name = "idx_celebration_employee", columnList = "employee_id, opened")
})
public class EmployeeCelebration extends BaseEntity {

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    /** BONUS | INCENTIVE | ALLOWANCE | SALARY */
    @Column(nullable = false, length = 20)
    private String kind;

    @Column(nullable = false, length = 200)
    private String title;

    /** HR's message for the employee, if any. */
    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(name = "source_type", nullable = false, length = 30)
    private String sourceType;

    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    @Column(name = "reward_date", nullable = false)
    private LocalDate rewardDate;

    /** False until the employee opens the gift (plays the celebration). */
    @Column(nullable = false)
    private boolean opened = false;
}
