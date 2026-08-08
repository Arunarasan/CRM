package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "employees")
public class Employee extends BaseEntity {

    @Column(name = "employee_code", nullable = false, unique = true, length = 50)
    private String employeeCode;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(length = 20)
    private String phone;

    @Column(name = "date_of_joining", nullable = false)
    private LocalDate dateOfJoining;

    @Column(length = 100)
    private String designation; // Role

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE, ON_LEAVE, TERMINATED

    @Column(name = "base_salary", precision = 15, scale = 2)
    private BigDecimal baseSalary = BigDecimal.ZERO;

    @Column(name = "emergency_contact_name", length = 100)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 20)
    private String emergencyContactPhone;

    @Column(name = "profile_photo_url", length = 500)
    private String profilePhotoUrl;

    // --- Payroll / statutory / banking (employee-only) ------------------------
    @Column(name = "salary_type", length = 30)
    private String salaryType; // MONTHLY, DAILY, HOURLY

    @Column(length = 50)
    private String shift;

    @Column(name = "attendance_required", nullable = false)
    private Boolean attendanceRequired = true;

    @Column(name = "leave_policy", length = 100)
    private String leavePolicy;

    @Column(name = "payroll_enabled", nullable = false)
    private Boolean payrollEnabled = true;

    @Column(name = "pf_number", length = 50)
    private String pfNumber;

    @Column(name = "esi_number", length = 50)
    private String esiNumber;

    @Column(name = "bank_account", length = 50)
    private String bankAccount;

    @Column(length = 20)
    private String ifsc;

    @Column(length = 50)
    private String uan;

    // --- Hourly wage configuration (HR-managed; employee read-only) -----------
    /** Hourly pay rate. Null means the employee is not hourly-paid (time still tracked, earnings 0). */
    @Column(name = "hourly_rate", precision = 10, scale = 2)
    private BigDecimal hourlyRate;

    @Column(name = "overtime_multiplier", nullable = false, precision = 5, scale = 2)
    private BigDecimal overtimeMultiplier = new BigDecimal("1.50");

    @Column(name = "weekend_multiplier", nullable = false, precision = 5, scale = 2)
    private BigDecimal weekendMultiplier = BigDecimal.ONE;

    @Column(name = "holiday_multiplier", nullable = false, precision = 5, scale = 2)
    private BigDecimal holidayMultiplier = new BigDecimal("2.00");

    @Column(name = "night_multiplier", nullable = false, precision = 5, scale = 2)
    private BigDecimal nightMultiplier = BigDecimal.ONE;

    /** Hours in a standard working day; hours beyond this count as overtime. */
    @Column(name = "standard_daily_hours", nullable = false, precision = 5, scale = 2)
    private BigDecimal standardDailyHours = new BigDecimal("8.00");

    // --- Explicit hourly rate overrides (V25). NULL = derive from hourly_rate x the matching multiplier.
    /** Explicit overtime pay per hour (e.g. ₹350). NULL ⇒ hourlyRate × overtimeMultiplier. */
    @Column(name = "overtime_rate", precision = 10, scale = 2)
    private BigDecimal overtimeRate;

    @Column(name = "holiday_rate", precision = 10, scale = 2)
    private BigDecimal holidayRate;

    @Column(name = "weekend_rate", precision = 10, scale = 2)
    private BigDecimal weekendRate;

    @Column(name = "night_rate", precision = 10, scale = 2)
    private BigDecimal nightRate;

    /** Optional daily cap on payable hours (safety against runaway clocks). NULL = no cap. */
    @Column(name = "max_daily_hours", precision = 5, scale = 2)
    private BigDecimal maxDailyHours;

    @Column(name = "bonus_eligible", nullable = false)
    private Boolean bonusEligible = true;

    /** MONTHLY, WEEKLY, BIWEEKLY. */
    @Column(name = "payroll_cycle", nullable = false, length = 20)
    private String payrollCycle = "MONTHLY";

    /** BANK_TRANSFER, CASH, CHEQUE, UPI. */
    @Column(name = "payment_method", length = 30)
    private String paymentMethod;

    /**
     * Unified workforce header this employee extends. Holds the shared fields (identity, address,
     * emergency contact, skills). One-to-one; the header owns the common data, this row the
     * employee-specific data (payroll, department, designation).
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workforce_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Workforce workforce;
}
