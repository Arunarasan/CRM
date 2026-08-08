package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;

/**
 * Employee payroll engine: salary structure, monthly payroll run (attendance/leave-driven, with PF/ESI/PT
 * and advance/loan recovery), advances, loans, payslips, register, dashboard and reports.
 *
 * <p>Contractor money is deliberately NOT computed here — the finance dashboard's contractor half only
 * reads the existing contractor bill/payment repositories. Employees and contractors share the master
 * record ({@link Workforce}) but keep separate financial workflows, per the module's design.
 */
@Service
public class PayrollService {

    private static final BigDecimal ESI_WAGE_CEILING = BigDecimal.valueOf(21000);
    private static final BigDecimal ESI_RATE = BigDecimal.valueOf(0.75);
    private static final List<String> ACTIVE_ADVANCE_STATES = List.of("APPROVED", "RECOVERING");

    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private SalaryStructureRepository structureRepository;
    @Autowired private SalaryRecordRepository salaryRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private com.arudra.crm.repository.UserRepository userRepository;
    @Autowired private EmployeeAdvanceRepository advanceRepository;
    @Autowired private EmployeeLoanRepository loanRepository;
    @Autowired private PayrollRecoveryRepository recoveryRepository;
    @Autowired private AttendanceRepository attendanceRepository;
    @Autowired private LeaveRequestRepository leaveRepository;
    @Autowired private ContractorBillRepository billRepository;
    @Autowired private ContractorPaymentRepository paymentRepository;
    @Autowired private ContractorWorkPackageRepository workPackageRepository;
    @Autowired private EmployeeBonusRepository bonusRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private EmployeeDeductionRepository deductionRepository;
    @Autowired private EmployeeTimeService timeService;

    // ============================================================ salary structure
    public SalaryStructure getStructure(Long employeeId) {
        return structureRepository.findFirstByEmployeeIdAndActiveTrueOrderByIdDesc(employeeId).orElse(null);
    }

    @Transactional
    public SalaryStructure saveStructure(Long employeeId, SalaryStructure payload) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        // One active structure per employee — retire the previous one.
        structureRepository.findFirstByEmployeeIdAndActiveTrueOrderByIdDesc(employeeId).ifPresent(old -> {
            old.setActive(false);
            structureRepository.save(old);
        });
        payload.setId(null);
        payload.setEmployee(employee);
        payload.setActive(true);
        if (payload.getEffectiveFrom() == null) payload.setEffectiveFrom(LocalDate.now());
        return structureRepository.save(payload);
    }

    // ============================================================ advances & loans
    @Transactional
    public EmployeeAdvance createAdvance(Long employeeId, EmployeeAdvance payload) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        payload.setId(null);
        payload.setEmployee(employee);
        payload.setStatus("PENDING");
        payload.setRecoveredAmount(BigDecimal.ZERO);
        payload.setBalance(nz(payload.getAmount()));
        if (payload.getAdvanceDate() == null) payload.setAdvanceDate(LocalDate.now());
        return advanceRepository.save(payload);
    }

    @Transactional
    public EmployeeAdvance approveAdvance(Long id, User approver) {
        EmployeeAdvance a = advanceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Advance not found: " + id));
        a.setStatus("APPROVED");
        a.setApprovedBy(approver);
        if (a.getBalance() == null || a.getBalance().signum() == 0) a.setBalance(nz(a.getAmount()));
        return advanceRepository.save(a);
    }

    public List<EmployeeAdvance> advancesForEmployee(Long employeeId) {
        return advanceRepository.findByEmployeeIdOrderByIdDesc(employeeId);
    }

    @Transactional
    public EmployeeLoan createLoan(Long employeeId, EmployeeLoan payload) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        payload.setId(null);
        payload.setEmployee(employee);
        payload.setStatus("ACTIVE");
        payload.setRecoveredAmount(BigDecimal.ZERO);
        payload.setBalance(nz(payload.getPrincipal()));
        if (payload.getDisbursedDate() == null) payload.setDisbursedDate(LocalDate.now());
        return loanRepository.save(payload);
    }

    @Transactional
    public EmployeeLoan closeLoan(Long id) {
        EmployeeLoan l = loanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Loan not found: " + id));
        l.setStatus("CLOSED");
        return loanRepository.save(l);
    }

    public List<EmployeeLoan> loansForEmployee(Long employeeId) {
        return loanRepository.findByEmployeeIdOrderByIdDesc(employeeId);
    }

    // ============================================================ payroll run
    /**
     * Generate one month's payslip for an employee. Idempotent: re-running the same (employee, month, year)
     * is rejected so recoveries are never double-applied. Pulls attendance/leave for LOP, applies PF/ESI/PT
     * and advance/loan recovery, and records each recovery as an immutable {@link PayrollRecovery}.
     */
    @Transactional
    public SalaryRecord runPayroll(Long employeeId, int month, int year,
                                   BigDecimal overtimeHours, BigDecimal bonus, BigDecimal incentive) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        salaryRepository.findByEmployeeIdAndMonthAndYear(employeeId, month, year).ifPresent(existing -> {
            throw new IllegalStateException("Payroll already generated for this employee for " + month + "/" + year);
        });

        SalaryStructure s = resolveStructure(employee);
        BigDecimal basic = nz(s.getBasic());
        BigDecimal hra = nz(s.getHra());
        BigDecimal allowances = nz(s.getAllowances()).add(nz(s.getSpecialAllowance()));

        // Attendance-driven LOP for the month.
        YearMonth ym = YearMonth.of(year, month);
        BigDecimal workingDays = BigDecimal.valueOf(ym.lengthOfMonth());
        BigDecimal lopDays = computeLopDays(employeeId, ym);
        BigDecimal paidDays = workingDays.subtract(lopDays).max(BigDecimal.ZERO);
        BigDecimal fixedGross = basic.add(hra).add(allowances);
        BigDecimal perDay = workingDays.signum() == 0 ? BigDecimal.ZERO
                : fixedGross.divide(workingDays, 2, RoundingMode.HALF_UP);
        BigDecimal leaveDeduction = perDay.multiply(lopDays).setScale(2, RoundingMode.HALF_UP);

        BigDecimal ot = nz(overtimeHours).multiply(nz(s.getOvertimeHourlyRate())).setScale(2, RoundingMode.HALF_UP);
        BigDecimal grossEarnings = fixedGross.add(ot).add(nz(bonus)).add(nz(incentive));

        // Statutory deductions.
        BigDecimal pf = Boolean.TRUE.equals(s.getPfEnabled()) ? pct(basic, s.getPfPercentage()) : BigDecimal.ZERO;
        BigDecimal esi = Boolean.TRUE.equals(s.getEsiEnabled()) && grossEarnings.compareTo(ESI_WAGE_CEILING) <= 0
                ? pct(grossEarnings, ESI_RATE) : BigDecimal.ZERO;
        BigDecimal pt = nz(s.getProfessionalTax());

        SalaryRecord rec = new SalaryRecord();
        rec.setEmployee(employee);
        rec.setMonth(month);
        rec.setYear(year);
        rec.setBasic(basic);
        rec.setHra(hra);
        rec.setAllowances(allowances);
        rec.setOvertimeHours(nz(overtimeHours));
        rec.setOvertimeAmount(ot);
        rec.setBonus(nz(bonus));
        rec.setIncentive(nz(incentive));
        rec.setGrossEarnings(grossEarnings);
        rec.setPfAmount(pf);
        rec.setEsiAmount(esi);
        rec.setProfessionalTax(pt);
        rec.setLeaveDeduction(leaveDeduction);
        rec.setWorkingDays(workingDays);
        rec.setPaidDays(paidDays);
        rec.setLopDays(lopDays);
        rec.setStatus("PENDING");
        rec.setGeneratedAt(LocalDateTime.now());
        rec.setPayslipNumber(String.format("PS-%04d%02d-%d", year, month, employeeId));
        // Provisional net (net_salary is NOT NULL) — finalised after recovery below.
        rec.setNetSalary(grossEarnings);
        // Persist now so recovery rows can reference it.
        rec = salaryRepository.save(rec);

        // Advance + loan recovery (writes immutable PayrollRecovery rows, decrements balances).
        BigDecimal advanceRecovery = recoverAdvances(employeeId, rec);
        BigDecimal loanRecovery = recoverLoans(employeeId, rec);

        BigDecimal totalDeductions = pf.add(esi).add(pt).add(leaveDeduction).add(advanceRecovery).add(loanRecovery);
        rec.setAdvanceRecovery(advanceRecovery);
        rec.setLoanRecovery(loanRecovery);
        rec.setTotalDeductions(totalDeductions);
        rec.setDeductions(totalDeductions); // legacy aggregate field kept in sync
        rec.setNetSalary(grossEarnings.subtract(totalDeductions));
        return salaryRepository.save(rec);
    }

    @Transactional
    public Map<String, Object> runPayrollBulk(int month, int year) {
        int done = 0, skipped = 0;
        List<String> errors = new ArrayList<>();
        for (Employee e : employeeRepository.findByPayrollEnabledTrueAndIsDeletedFalse()) {
            if (salaryRepository.findByEmployeeIdAndMonthAndYear(e.getId(), month, year).isPresent()) {
                skipped++;
                continue;
            }
            try {
                runPayroll(e.getId(), month, year, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
                done++;
            } catch (Exception ex) {
                errors.add(e.getId() + ": " + ex.getMessage());
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("generated", done);
        out.put("skipped", skipped);
        out.put("errors", errors);
        return out;
    }

    // ============================================================ hourly payroll run
    /**
     * Generate one period's HOURLY payslip for an employee — the spec's model: pay = regular hourly
     * earnings + overtime + approved project/manual bonuses + incentives − manual deductions − advance
     * and loan recovery. Regular/OT earnings come from persisted attendance (recomputed against the wage
     * config). Idempotent per (employee, month, year). Approved bonuses/deductions are absorbed once and
     * linked to this payslip. Starts DRAFT/PENDING → {@link #approvePayroll} → {@link #markPaid}.
     */
    @Transactional
    public SalaryRecord runHourlyPayroll(Long employeeId, int month, int year,
                                         BigDecimal extraBonus, BigDecimal extraIncentive) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        if (employee.getHourlyRate() == null) {
            throw new IllegalArgumentException("Employee has no hourly rate configured — set an hourly rate first.");
        }
        salaryRepository.findByEmployeeIdAndMonthAndYear(employeeId, month, year).ifPresent(existing -> {
            throw new IllegalStateException("Payroll already generated for this employee for " + month + "/" + year);
        });

        YearMonth ym = YearMonth.of(year, month);
        Map<String, Object> sum = timeService.hourlySummary(employee, ym.atDay(1), ym.atEndOfMonth());
        BigDecimal workedHours = (BigDecimal) sum.get("workedHours");
        BigDecimal regularHours = (BigDecimal) sum.get("regularHours");
        BigDecimal overtimeHours = (BigDecimal) sum.get("overtimeHours");
        BigDecimal regularEarnings = (BigDecimal) sum.get("regularEarnings");
        BigDecimal overtimeEarnings = (BigDecimal) sum.get("overtimeEarnings");
        int attendanceDays = (int) sum.get("attendanceDays");

        // Persist the shell first (net_salary is NOT NULL, and bonus/deduction/recovery rows FK it).
        SalaryRecord rec = new SalaryRecord();
        rec.setEmployee(employee);
        rec.setMonth(month);
        rec.setYear(year);
        rec.setPayType("HOURLY");
        rec.setBasic(BigDecimal.ZERO);        // hourly pay has no fixed basic
        rec.setHra(BigDecimal.ZERO);
        rec.setAllowances(BigDecimal.ZERO);
        rec.setHourlyRate(employee.getHourlyRate());
        rec.setOvertimeRate(EmployeeTimeService.overtimeRate(employee));
        rec.setWorkedHours(workedHours);
        rec.setRegularHours(regularHours);
        rec.setOvertimeHours(overtimeHours);
        rec.setRegularEarnings(regularEarnings);
        rec.setOvertimeAmount(overtimeEarnings);
        rec.setAttendanceDays(attendanceDays);
        rec.setWorkingDays(BigDecimal.valueOf(ym.lengthOfMonth()));
        rec.setPaidDays(BigDecimal.valueOf(attendanceDays));
        rec.setStatus("PENDING");
        rec.setGeneratedAt(LocalDateTime.now());
        rec.setPayslipNumber(String.format("PS-%04d%02d-%d", year, month, employeeId));
        rec.setNetSalary(regularEarnings.add(overtimeEarnings)); // provisional
        rec = salaryRepository.save(rec);

        // Approved, unpaid bonuses (project / manual / incentive) — absorb once, link to this payslip.
        BigDecimal projectBonus = BigDecimal.ZERO, manualBonus = BigDecimal.ZERO, incentive = nz(extraIncentive);
        if (Boolean.TRUE.equals(employee.getBonusEligible())) {
            for (EmployeeBonus b : bonusRepository
                    .findByEmployeeIdAndStatusAndPaidSalaryRecordIdIsNullAndIsDeletedFalse(employeeId, "APPROVED")) {
                BigDecimal amt = nz(b.getAmount());
                if ("INCENTIVE".equalsIgnoreCase(b.getBonusType())) incentive = incentive.add(amt);
                else if (b.getProject() != null || "PROJECT_COMPLETION".equalsIgnoreCase(b.getBonusType()))
                    projectBonus = projectBonus.add(amt);
                else manualBonus = manualBonus.add(amt);
                b.setStatus("PAID");
                b.setPaidAt(LocalDateTime.now());
                b.setPaidSalaryRecordId(rec.getId());
                bonusRepository.save(b);
            }
        }
        manualBonus = manualBonus.add(nz(extraBonus));

        // Approved, unapplied manual deductions (respect a target period if the deduction set one).
        BigDecimal manualDeduction = BigDecimal.ZERO;
        for (EmployeeDeduction dd : deductionRepository
                .findByEmployeeIdAndStatusAndAppliedSalaryRecordIdIsNullAndIsDeletedFalse(employeeId, "APPROVED")) {
            if (dd.getTargetMonth() != null && dd.getTargetYear() != null
                    && !(dd.getTargetMonth() == month && dd.getTargetYear() == year)) continue;
            manualDeduction = manualDeduction.add(nz(dd.getAmount()));
            dd.setStatus("APPLIED");
            dd.setAppliedSalaryRecordId(rec.getId());
            deductionRepository.save(dd);
        }

        // Advance + loan recovery (immutable PayrollRecovery rows; balances decremented).
        BigDecimal advanceRecovery = recoverAdvances(employeeId, rec);
        BigDecimal loanRecovery = recoverLoans(employeeId, rec);

        BigDecimal gross = regularEarnings.add(overtimeEarnings).add(projectBonus).add(manualBonus).add(incentive);
        BigDecimal totalDeductions = manualDeduction.add(advanceRecovery).add(loanRecovery);
        rec.setProjectBonus(projectBonus);
        rec.setManualBonus(manualBonus);
        rec.setBonus(projectBonus.add(manualBonus));
        rec.setIncentive(incentive);
        rec.setGrossEarnings(gross);
        rec.setManualDeduction(manualDeduction);
        rec.setOtherDeductions(manualDeduction);
        rec.setAdvanceRecovery(advanceRecovery);
        rec.setLoanRecovery(loanRecovery);
        rec.setTotalDeductions(totalDeductions);
        rec.setDeductions(totalDeductions);
        rec.setNetSalary(gross.subtract(totalDeductions));
        return salaryRepository.save(rec);
    }

    /** Run hourly payroll for every hourly-paid, payroll-enabled employee for the period. Idempotent. */
    @Transactional
    public Map<String, Object> runHourlyPayrollBulk(int month, int year) {
        int done = 0, skipped = 0;
        List<String> errors = new ArrayList<>();
        for (Employee e : employeeRepository.findByPayrollEnabledTrueAndIsDeletedFalse()) {
            if (e.getHourlyRate() == null) { skipped++; continue; }
            if (salaryRepository.findByEmployeeIdAndMonthAndYear(e.getId(), month, year).isPresent()) {
                skipped++;
                continue;
            }
            try {
                runHourlyPayroll(e.getId(), month, year, BigDecimal.ZERO, BigDecimal.ZERO);
                done++;
            } catch (Exception ex) {
                errors.add(e.getId() + ": " + ex.getMessage());
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("generated", done);
        out.put("skipped", skipped);
        out.put("errors", errors);
        return out;
    }

    /** HR approves a generated payslip (PENDING → APPROVED) before it can be marked paid. */
    @Transactional
    public SalaryRecord approvePayroll(Long salaryRecordId, User approver) {
        SalaryRecord rec = salaryRepository.findById(salaryRecordId)
                .orElseThrow(() -> new ResourceNotFoundException("Salary record not found: " + salaryRecordId));
        if ("PAID".equals(rec.getStatus())) {
            throw new IllegalStateException("This payslip is already paid.");
        }
        rec.setStatus("APPROVED");
        rec.setApprovedBy(approver);
        rec.setApprovedAt(LocalDateTime.now());
        return salaryRepository.save(rec);
    }

    @Transactional
    public SalaryRecord markPaid(Long salaryRecordId) {
        SalaryRecord rec = salaryRepository.findById(salaryRecordId)
                .orElseThrow(() -> new ResourceNotFoundException("Salary record not found: " + salaryRecordId));
        rec.setStatus("PAID");
        rec.setPaymentDate(LocalDate.now());
        SalaryRecord saved = salaryRepository.save(rec);
        // Notify the employee (via their own login, resolved by email) that they've been paid.
        if (saved.getEmployee() != null && saved.getEmployee().getEmail() != null) {
            userRepository.findByEmail(saved.getEmployee().getEmail()).ifPresent(u ->
                    notificationService.dispatch("Salary Paid",
                            "Your salary for " + saved.getMonth() + "/" + saved.getYear() + " has been paid"
                                    + (saved.getNetSalary() != null ? " (₹" + saved.getNetSalary() + ")" : "") + ".",
                            "SALARY", u.getId(), "/employee/salary"));
        }
        return saved;
    }

    public Map<String, Object> getPayslip(Long salaryRecordId) {
        SalaryRecord rec = salaryRepository.findById(salaryRecordId)
                .orElseThrow(() -> new ResourceNotFoundException("Salary record not found: " + salaryRecordId));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("record", rec);
        out.put("recoveries", recoveryRepository.findBySalaryRecordId(salaryRecordId));
        return out;
    }

    public List<SalaryRecord> getRegister(int month, int year) {
        return salaryRepository.findByMonthAndYearOrderByIdDesc(month, year);
    }

    public List<SalaryRecord> historyForEmployee(Long employeeId) {
        return salaryRepository.findByEmployeeIdOrderByYearDescMonthDesc(employeeId);
    }

    // ============================================================ employee bonuses
    private static final List<String> BONUS_TYPES =
            List.of("PROJECT_COMPLETION", "QUALITY", "PERFORMANCE", "TARGET_ACHIEVEMENT",
                    "FESTIVAL", "ATTENDANCE", "MANUAL", "INCENTIVE", "OTHER");

    /** Admin awards a bonus to an employee (project-completion / performance / other). Starts PENDING. */
    @Transactional
    public EmployeeBonus awardBonus(Long employeeId, EmployeeBonus payload, User awardedBy) {
        EmployeeBonus bonus = buildBonus(employeeId, payload);
        bonus.setStatus("PENDING");
        bonus.setAwardedBy(awardedBy);
        EmployeeBonus saved = bonusRepository.save(bonus);
        notifyEmployeeUser(bonus.getEmployee(), "Bonus Awarded",
                "A " + prettyType(saved.getBonusType()) + " bonus of " + inr(saved.getAmount()) + " has been added to your account (pending approval).");
        return saved;
    }

    /**
     * A Project Manager recommends a bonus for an employee. Starts RECOMMENDED, awaiting HR review;
     * {@link #approveBonus} moves it to APPROVED so a payroll run can absorb it.
     */
    @Transactional
    public EmployeeBonus recommendBonus(Long employeeId, EmployeeBonus payload, User recommender) {
        EmployeeBonus bonus = buildBonus(employeeId, payload);
        bonus.setStatus("RECOMMENDED");
        bonus.setRecommendedBy(recommender);
        EmployeeBonus saved = bonusRepository.save(bonus);
        notifyEmployeeUser(bonus.getEmployee(), "Bonus Recommended",
                "A " + prettyType(saved.getBonusType()) + " bonus of " + inr(saved.getAmount())
                        + " has been recommended for you (awaiting HR approval).");
        return saved;
    }

    /** Shared bonus builder used by both {@link #awardBonus} and {@link #recommendBonus}. */
    private EmployeeBonus buildBonus(Long employeeId, EmployeeBonus payload) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        if (payload.getAmount() == null || payload.getAmount().signum() <= 0) {
            throw new IllegalArgumentException("Bonus amount must be greater than zero");
        }
        String type = payload.getBonusType() == null ? "OTHER" : payload.getBonusType().toUpperCase();
        if (!BONUS_TYPES.contains(type)) {
            throw new IllegalArgumentException("Unknown bonus type: " + type);
        }
        EmployeeBonus bonus = new EmployeeBonus();
        bonus.setEmployee(employee);
        bonus.setBonusType(type);
        bonus.setAmount(payload.getAmount());
        bonus.setReason(payload.getReason());
        bonus.setAwardDate(payload.getAwardDate() != null ? payload.getAwardDate() : LocalDate.now());
        if (payload.getProject() != null && payload.getProject().getId() != null) {
            bonus.setProject(projectRepository.findById(payload.getProject().getId()).orElse(null));
        }
        return bonus;
    }

    public List<EmployeeBonus> bonusesForEmployee(Long employeeId) {
        return bonusRepository.findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(employeeId);
    }

    public List<EmployeeBonus> allBonuses(String status) {
        return (status == null || status.isBlank())
                ? bonusRepository.findByIsDeletedFalseOrderByIdDesc()
                : bonusRepository.findByStatusAndIsDeletedFalseOrderByIdDesc(status.toUpperCase());
    }

    @Transactional
    public EmployeeBonus approveBonus(Long id, User approver) {
        EmployeeBonus bonus = getBonus(id);
        if (!"PENDING".equals(bonus.getStatus()) && !"RECOMMENDED".equals(bonus.getStatus())) {
            throw new IllegalStateException("Only a PENDING or RECOMMENDED bonus can be approved");
        }
        bonus.setStatus("APPROVED");
        bonus.setApprovedBy(approver);
        bonus.setDecidedAt(LocalDateTime.now());
        EmployeeBonus saved = bonusRepository.save(bonus);
        notifyEmployeeUser(bonus.getEmployee(), "Bonus Approved",
                "Your " + prettyType(bonus.getBonusType()) + " bonus of " + inr(bonus.getAmount()) + " has been approved.");
        return saved;
    }

    @Transactional
    public EmployeeBonus markBonusPaid(Long id) {
        EmployeeBonus bonus = getBonus(id);
        if ("PAID".equals(bonus.getStatus())) {
            return bonus;
        }
        if ("PENDING".equals(bonus.getStatus())) {
            bonus.setDecidedAt(LocalDateTime.now());
        }
        bonus.setStatus("PAID");
        bonus.setPaidAt(LocalDateTime.now());
        EmployeeBonus saved = bonusRepository.save(bonus);
        notifyEmployeeUser(bonus.getEmployee(), "Bonus Paid",
                "Your " + prettyType(bonus.getBonusType()) + " bonus of " + inr(bonus.getAmount()) + " has been paid.");
        return saved;
    }

    /** Totals for one employee's account view. */
    public Map<String, Object> bonusSummary(Long employeeId) {
        List<EmployeeBonus> list = bonusesForEmployee(employeeId);
        BigDecimal paid = BigDecimal.ZERO, approved = BigDecimal.ZERO, pending = BigDecimal.ZERO;
        for (EmployeeBonus b : list) {
            switch (b.getStatus()) {
                case "PAID" -> paid = paid.add(nz(b.getAmount()));
                case "APPROVED" -> approved = approved.add(nz(b.getAmount()));
                case "PENDING" -> pending = pending.add(nz(b.getAmount()));
                default -> { }
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("bonuses", list);
        out.put("totalPaid", paid);
        out.put("totalApproved", approved);
        out.put("totalPending", pending);
        out.put("totalAll", paid.add(approved).add(pending));
        return out;
    }

    private EmployeeBonus getBonus(Long id) {
        return bonusRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bonus not found: " + id));
    }

    private String prettyType(String t) {
        if (t == null) return "";
        return t.charAt(0) + t.substring(1).toLowerCase().replace('_', ' ');
    }

    /** Best-effort push to the employee's linked User (by email); silent if none. */
    private void notifyEmployeeUser(Employee employee, String title, String body) {
        if (employee == null || employee.getEmail() == null) return;
        userRepository.findByEmail(employee.getEmail()).ifPresent(u ->
                notificationService.dispatch(title, body, "HR", u.getId(), "/employee/salary"));
    }

    // ============================================================ hourly pay register

    /**
     * Per-employee hourly-pay earnings for a month: for every hourly-paid employee, sum the persisted
     * attendance worked/overtime hours and day earnings. Answers "which employee gets how much".
     */
    public Map<String, Object> hourlyPayRegister(int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate from = ym.atDay(1), to = ym.atEndOfMonth();
        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal grand = BigDecimal.ZERO;
        for (Employee e : employeeRepository.findAll()) {
            if (Boolean.TRUE.equals(e.getIsDeleted())) continue;
            if (e.getHourlyRate() == null) continue; // only hourly-paid employees
            List<Attendance> days = attendanceRepository.findByEmployeeIdAndDateBetween(e.getId(), from, to);
            BigDecimal worked = BigDecimal.ZERO, ot = BigDecimal.ZERO, earned = BigDecimal.ZERO;
            for (Attendance a : days) {
                worked = worked.add(nz(a.getWorkedHours()));
                ot = ot.add(nz(a.getOvertimeHours()));
                earned = earned.add(nz(a.getDayEarnings()));
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("employeeId", e.getId());
            row.put("employeeName", (nzs(e.getFirstName()) + " " + nzs(e.getLastName())).trim());
            row.put("employeeCode", e.getEmployeeCode());
            row.put("hourlyRate", e.getHourlyRate());
            row.put("overtimeMultiplier", e.getOvertimeMultiplier());
            row.put("workedHours", worked);
            row.put("overtimeHours", ot);
            row.put("earnings", earned);
            row.put("daysPresent", days.size());
            rows.add(row);
            grand = grand.add(earned);
        }
        rows.sort((a, b) -> ((BigDecimal) b.get("earnings")).compareTo((BigDecimal) a.get("earnings")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("month", month);
        out.put("year", year);
        out.put("rows", rows);
        out.put("totalEarnings", grand);
        out.put("employeeCount", rows.size());
        return out;
    }

    /** HR sets an employee's hourly wage config. Employee-side is read-only. */
    @Transactional
    public Employee setHourlyRate(Long employeeId, BigDecimal hourlyRate, BigDecimal overtimeMultiplier) {
        Employee e = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        e.setHourlyRate(hourlyRate);
        if (overtimeMultiplier != null) e.setOvertimeMultiplier(overtimeMultiplier);
        return employeeRepository.save(e);
    }

    /**
     * HR saves the full hourly wage settings for an employee (rates, multipliers, cycle, payment method,
     * bank details). The form always sends the complete object, so fields are copied as-is. Employee-side
     * is read-only.
     */
    @Transactional
    public Employee saveWageSettings(Long employeeId, Employee payload) {
        Employee e = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        e.setSalaryType(payload.getSalaryType() != null ? payload.getSalaryType() : "HOURLY");
        e.setHourlyRate(payload.getHourlyRate());
        e.setOvertimeRate(payload.getOvertimeRate());
        e.setHolidayRate(payload.getHolidayRate());
        e.setWeekendRate(payload.getWeekendRate());
        e.setNightRate(payload.getNightRate());
        if (payload.getOvertimeMultiplier() != null) e.setOvertimeMultiplier(payload.getOvertimeMultiplier());
        if (payload.getWeekendMultiplier() != null) e.setWeekendMultiplier(payload.getWeekendMultiplier());
        if (payload.getHolidayMultiplier() != null) e.setHolidayMultiplier(payload.getHolidayMultiplier());
        if (payload.getNightMultiplier() != null) e.setNightMultiplier(payload.getNightMultiplier());
        if (payload.getStandardDailyHours() != null) e.setStandardDailyHours(payload.getStandardDailyHours());
        e.setMaxDailyHours(payload.getMaxDailyHours());
        if (payload.getBonusEligible() != null) e.setBonusEligible(payload.getBonusEligible());
        if (payload.getPayrollCycle() != null) e.setPayrollCycle(payload.getPayrollCycle());
        e.setPaymentMethod(payload.getPaymentMethod());
        if (payload.getBankAccount() != null) e.setBankAccount(payload.getBankAccount());
        if (payload.getIfsc() != null) e.setIfsc(payload.getIfsc());
        return employeeRepository.save(e);
    }

    // ============================================================ manual deductions
    private static final List<String> DEDUCTION_TYPES =
            List.of("FINE", "DAMAGE", "ADVANCE_RECOVERY", "LOAN_RECOVERY", "OTHER");

    /** HR records a manual deduction (fine / damage / other). Starts PENDING → {@link #approveDeduction}. */
    @Transactional
    public EmployeeDeduction createDeduction(Long employeeId, EmployeeDeduction payload) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        if (payload.getAmount() == null || payload.getAmount().signum() <= 0) {
            throw new IllegalArgumentException("Deduction amount must be greater than zero");
        }
        String type = payload.getDeductionType() == null ? "OTHER" : payload.getDeductionType().toUpperCase();
        if (!DEDUCTION_TYPES.contains(type)) {
            throw new IllegalArgumentException("Unknown deduction type: " + type);
        }
        EmployeeDeduction d = new EmployeeDeduction();
        d.setEmployee(employee);
        d.setDeductionType(type);
        d.setAmount(payload.getAmount());
        d.setReason(payload.getReason());
        d.setDeductionDate(payload.getDeductionDate() != null ? payload.getDeductionDate() : LocalDate.now());
        d.setTargetMonth(payload.getTargetMonth());
        d.setTargetYear(payload.getTargetYear());
        d.setStatus("PENDING");
        return deductionRepository.save(d);
    }

    @Transactional
    public EmployeeDeduction approveDeduction(Long id, User approver) {
        EmployeeDeduction d = deductionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Deduction not found: " + id));
        if (!"PENDING".equals(d.getStatus())) {
            throw new IllegalStateException("Only a PENDING deduction can be approved");
        }
        d.setStatus("APPROVED");
        d.setApprovedBy(approver);
        d.setDecidedAt(LocalDateTime.now());
        return deductionRepository.save(d);
    }

    public List<EmployeeDeduction> deductionsForEmployee(Long employeeId) {
        return deductionRepository.findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(employeeId);
    }

    public List<EmployeeDeduction> allDeductions(String status) {
        return (status == null || status.isBlank())
                ? deductionRepository.findByIsDeletedFalseOrderByIdDesc()
                : deductionRepository.findByStatusAndIsDeletedFalseOrderByIdDesc(status.toUpperCase());
    }

    private String nzs(String s) { return s == null ? "" : s; }

    private String inr(BigDecimal v) {
        return "₹" + (v == null ? "0" : v.stripTrailingZeros().toPlainString());
    }

    // ============================================================ finance dashboard
    public Map<String, Object> financeDashboard() {
        LocalDate now = LocalDate.now();
        int month = now.getMonthValue(), year = now.getYear();

        Map<String, Object> employee = new LinkedHashMap<>();
        employee.put("payrollDue", salaryRepository.sumNetByMonthYearAndStatus(month, year, "PENDING"));
        employee.put("salaryPaidThisMonth", salaryRepository.sumNetByMonthYearAndStatus(month, year, "PAID"));
        employee.put("salaryPaidYtd", salaryRepository.sumPaidNetByYear(year));
        employee.put("advancesOutstanding", nz(advanceRepository.sumOutstandingAdvances()));
        employee.put("loansOutstanding", nz(loanRepository.sumOutstandingLoans()));

        Map<String, Object> contractor = new LinkedHashMap<>();
        contractor.put("outstandingPayments", nz(billRepository.sumAllOutstanding()));
        BigDecimal upcoming = billRepository.findPayable().stream()
                .map(ContractorBill::getBalanceAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        contractor.put("upcomingPayments", upcoming);
        BigDecimal overdue = paymentRepository.findByStatusOrderByIdDesc("OVERDUE").stream()
                .map(ContractorPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        contractor.put("overduePayments", overdue);
        contractor.put("contractValue", nz(workPackageRepository.sumAllApprovedCost()));
        contractor.put("paymentRequestsPendingApproval", billRepository.findPendingApproval().size());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("employee", employee);
        out.put("contractor", contractor);
        return out;
    }

    // ============================================================ reports
    public Object report(String type, Integer month, Integer year) {
        String r = type == null ? "" : type.toLowerCase();
        switch (r) {
            case "payroll-register":
                return (month != null && year != null) ? getRegister(month, year)
                        : salaryRepository.findAll();
            case "advances":
                return advanceRepository.findAll();
            case "loans":
                return loanRepository.findAll();
            case "salary-history":
            case "attendance-vs-payroll":
            default:
                return salaryRepository.findAll();
        }
    }

    // ============================================================ helpers
    private SalaryStructure resolveStructure(Employee employee) {
        SalaryStructure s = structureRepository.findFirstByEmployeeIdAndActiveTrueOrderByIdDesc(employee.getId())
                .orElse(null);
        if (s != null) return s;
        // Fall back to a minimal structure derived from the employee's base salary so payroll can still run.
        SalaryStructure fallback = new SalaryStructure();
        fallback.setBasic(nz(employee.getBaseSalary()));
        fallback.setPfEnabled(false);
        fallback.setEsiEnabled(false);
        return fallback;
    }

    /** LOP = ABSENT days (+0.5 per HALF_DAY) recorded that month; no attendance rows ⇒ assume fully paid. */
    private BigDecimal computeLopDays(Long employeeId, YearMonth ym) {
        List<Attendance> rows = attendanceRepository.findByEmployeeIdAndDateBetween(
                employeeId, ym.atDay(1), ym.atEndOfMonth());
        BigDecimal lop = BigDecimal.ZERO;
        for (Attendance a : rows) {
            if ("ABSENT".equalsIgnoreCase(a.getStatus())) lop = lop.add(BigDecimal.ONE);
            else if ("HALF_DAY".equalsIgnoreCase(a.getStatus())) lop = lop.add(BigDecimal.valueOf(0.5));
        }
        return lop;
    }

    private BigDecimal recoverAdvances(Long employeeId, SalaryRecord rec) {
        BigDecimal total = BigDecimal.ZERO;
        List<EmployeeAdvance> advances = advanceRepository
                .findByEmployeeIdAndStatusInAndBalanceGreaterThanOrderByIdAsc(
                        employeeId, ACTIVE_ADVANCE_STATES, BigDecimal.ZERO);
        for (EmployeeAdvance a : advances) {
            BigDecimal due = nz(a.getMonthlyRecovery()).signum() > 0 ? a.getMonthlyRecovery() : a.getBalance();
            BigDecimal take = due.min(a.getBalance());
            if (take.signum() <= 0) continue;
            a.setRecoveredAmount(nz(a.getRecoveredAmount()).add(take));
            a.setBalance(a.getBalance().subtract(take));
            a.setStatus(a.getBalance().signum() <= 0 ? "RECOVERED" : "RECOVERING");
            advanceRepository.save(a);
            recoveryRepository.save(recovery(rec, "ADVANCE", a.getId(), take));
            total = total.add(take);
        }
        return total;
    }

    private BigDecimal recoverLoans(Long employeeId, SalaryRecord rec) {
        BigDecimal total = BigDecimal.ZERO;
        List<EmployeeLoan> loans = loanRepository
                .findByEmployeeIdAndStatusAndBalanceGreaterThanOrderByIdAsc(employeeId, "ACTIVE", BigDecimal.ZERO);
        for (EmployeeLoan l : loans) {
            BigDecimal due = nz(l.getEmiAmount()).signum() > 0 ? l.getEmiAmount() : l.getBalance();
            BigDecimal take = due.min(l.getBalance());
            if (take.signum() <= 0) continue;
            l.setRecoveredAmount(nz(l.getRecoveredAmount()).add(take));
            l.setBalance(l.getBalance().subtract(take));
            if (l.getBalance().signum() <= 0) l.setStatus("CLOSED");
            loanRepository.save(l);
            recoveryRepository.save(recovery(rec, "LOAN", l.getId(), take));
            total = total.add(take);
        }
        return total;
    }

    private static PayrollRecovery recovery(SalaryRecord rec, String type, Long sourceId, BigDecimal amount) {
        PayrollRecovery pr = new PayrollRecovery();
        pr.setSalaryRecord(rec);
        pr.setSourceType(type);
        pr.setSourceId(sourceId);
        pr.setAmount(amount);
        return pr;
    }

    private static BigDecimal pct(BigDecimal base, BigDecimal percentage) {
        if (base == null || percentage == null || percentage.signum() == 0) return BigDecimal.ZERO;
        return base.multiply(percentage).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
