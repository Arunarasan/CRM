package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A money request an employee raises from the self-service app for HR/Admin to approve. Lifecycle:
 * PENDING → APPROVED → APPLIED (or CONVERTED / REJECTED). What "APPROVED" does depends on the type:
 * <ul>
 *   <li><b>ADVANCE</b> — a salary advance ("take this much this month"). On approval an
 *       {@link EmployeeAdvance} (APPROVED) is spawned so the existing multi-month recovery engine
 *       handles it; the request moves to CONVERTED.</li>
 *   <li><b>LOAN_REPAYMENT</b> — an extra repayment of {@code amount} against loan {@code loanId} for
 *       {@code targetMonth}/{@code targetYear}; absorbed by that month's payroll run (reduces the loan
 *       balance, recorded as a loan recovery), then linked via {@code appliedSalaryRecordId}.</li>
 *   <li><b>ADVANCE_REPAYMENT</b> — same, but against advance {@code advanceId} (reduces the advance
 *       balance, recorded as an advance recovery).</li>
 *   <li><b>SET_RECOVERY</b> — the employee proposes the monthly recovery/EMI ({@code amount}) for a
 *       loan ({@code loanId}) or advance ({@code advanceId}). On approval the loan's EMI / advance's
 *       monthly recovery is set to that amount immediately (no payroll run needed); request → APPLIED.</li>
 *   <li><b>OTHER</b> — a free-form adjustment for the target month; {@code direction} DEBIT reduces
 *       net pay (into other_deductions), CREDIT adds to it (into other_earnings).</li>
 * </ul>
 * Employee-raised and self-scoped: {@code requestedBy} is the login, {@code employee} the HR record.
 */
@Getter
@Setter
@Entity
@Table(name = "payroll_requests", indexes = {
        @Index(name = "idx_payreq_employee", columnList = "employee_id"),
        @Index(name = "idx_payreq_status", columnList = "status")
})
public class PayrollRequest extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "workforce", "department"})
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User requestedBy;

    /** ADVANCE, LOAN_REPAYMENT, OTHER. */
    @Column(name = "request_type", nullable = false, length = 30)
    private String requestType;

    /** DEBIT (reduces pay) or CREDIT (adds to pay). Meaningful for OTHER; advances/repayments are DEBIT. */
    @Column(nullable = false, length = 10)
    private String direction = "DEBIT";

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    /** Suggested per-month recovery for an advance (optional). */
    @Column(name = "monthly_recovery", precision = 15, scale = 2)
    private BigDecimal monthlyRecovery;

    /** The month this request should be applied in (LOAN_REPAYMENT / OTHER). */
    @Column(name = "target_month")
    private Integer targetMonth;

    @Column(name = "target_year")
    private Integer targetYear;

    /** The loan this request targets (LOAN_REPAYMENT, or SET_RECOVERY on a loan). */
    @Column(name = "loan_id")
    private Long loanId;

    /** The advance this request targets (ADVANCE_REPAYMENT, or SET_RECOVERY on an advance). */
    @Column(name = "advance_id")
    private Long advanceId;

    @Column(columnDefinition = "TEXT")
    private String reason;

    /** PENDING, APPROVED, APPLIED, CONVERTED, REJECTED. */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User approvedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "admin_remarks", columnDefinition = "TEXT")
    private String adminRemarks;

    /** The payslip that absorbed this request (LOAN_REPAYMENT / OTHER), set on payroll run. */
    @Column(name = "applied_salary_record_id")
    private Long appliedSalaryRecordId;

    /** The EmployeeAdvance spawned when an ADVANCE request is approved. */
    @Column(name = "converted_advance_id")
    private Long convertedAdvanceId;
}
