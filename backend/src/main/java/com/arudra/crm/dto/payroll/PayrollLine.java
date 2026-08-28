package com.arudra.crm.dto.payroll;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * One unified pay-run row for a single person — an employee OR a contractor — for a chosen period.
 *
 * <p>Read-only projection assembled in {@code PayrollService.unifiedRegister}. It does not persist:
 * employee rows come from a {@code SalaryRecord}; contractor rows are folded from the contractor
 * bill/ledger engine (Option B — a contractor with an open balance shows on every period, and the
 * period columns reflect what was billed within it). The two engines' statuses are normalised into a
 * small shared set so the frontend can render one table with per-type actions.
 */
@Getter
@Setter
public class PayrollLine {

    /** EMPLOYEE | CONTRACTOR — drives the row colour, tag, and which actions are offered. */
    private String resourceType;

    /** Employee id (→ /hr/employees/:id) or contractor id (→ /contractors/directory/:id). */
    private Long personId;

    private String name;
    private String code;

    /** MONTHLY | HOURLY | CONTRACT — three pay models, one column. */
    private String payModel;

    /** Human basis: "22 days" / "168h · 6 OT" for employees, "2 bills · WP" for contractors. */
    private String basisLabel;

    /** Period gross. Null for a contractor with no bill dated in the period. */
    private BigDecimal gross;

    /** Period deductions (statutory + recoveries for employees; retention held for contractors). */
    private BigDecimal deductions;

    /** The one comparable number: employee net salary, or contractor amount owed. */
    private BigDecimal payable;

    /** Running ledger balance (pending amount) — always shown for contractors (Option B); null for employees. */
    private BigDecimal outstanding;

    /** Contractor-only: total value billed across all live bills (advances + regular work). Null for employees. */
    private BigDecimal billedTotal;

    /** Contractor-only: total paid to date across all bills, including advances. Null for employees. */
    private BigDecimal paidToDate;

    /** Normalised across both engines: PENDING · APPROVED · PAID (emp); DUE · PENDING · PAID (con). */
    private String status;

    /** Salary record id for inline employee approve/pay; null for contractors. */
    private Long recordId;

    /**
     * What the row's primary action should do, decided server-side so the frontend stays declarative:
     * APPROVE, PAY, VIEW (employee) · OPEN_BILL, LEDGER (contractor — always a deep-link, never inline pay).
     */
    private String actionHint;

    private int month;
    private int year;
}
