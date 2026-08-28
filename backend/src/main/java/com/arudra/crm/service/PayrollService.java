package com.arudra.crm.service;

import com.arudra.crm.dto.payroll.PayrollLine;
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
    /** Standard paid working days/month used to convert a monthly salary into an equivalent hourly rate. */
    private static final int STANDARD_WORKING_DAYS = 26;
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
    @Autowired private com.arudra.crm.repository.PayrollRequestRepository payrollRequestRepository;
    @Autowired private EmployeeTimeService timeService;
    @Autowired private com.arudra.crm.repository.TaskAssignmentRepository taskAssignmentRepository;
    @Autowired private com.arudra.crm.repository.TaskTimeLogRepository taskTimeLogRepository;

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

    // ================================================ employee payroll requests
    /**
     * Saves an employee-raised money request (advance / one-off loan repayment / other) as PENDING and
     * notifies admins. The caller (portal) has already resolved and set the employee + requestedBy and
     * validated ownership of any referenced loan.
     */
    @Transactional
    public com.arudra.crm.entity.PayrollRequest createPayrollRequest(com.arudra.crm.entity.PayrollRequest payload) {
        if (payload.getEmployee() == null) throw new IllegalArgumentException("Employee is required.");
        if (payload.getAmount() == null || payload.getAmount().signum() <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero.");
        }
        String type = payload.getRequestType();
        if (type == null) throw new IllegalArgumentException("Request type is required.");
        payload.setId(null);
        payload.setStatus("PENDING");
        payload.setApprovedBy(null);
        payload.setDecidedAt(null);
        payload.setAppliedSalaryRecordId(null);
        payload.setConvertedAdvanceId(null);
        if (!"CREDIT".equalsIgnoreCase(payload.getDirection())) payload.setDirection("DEBIT");
        com.arudra.crm.entity.PayrollRequest saved = payrollRequestRepository.save(payload);
        // Link straight to this employee's profile → Payroll tab, where the request shows in the
        // Advances / Loans cards and can be approved.
        String link = "/hr/employees/" + payload.getEmployee().getId() + "?tab=payroll";
        notificationService.dispatchToAdmins("Payroll Request",
                (payload.getEmployee().getFirstName() != null ? payload.getEmployee().getFirstName() : "An employee")
                        + " raised a " + prettyRequestType(type) + " request of " + saved.getAmount(),
                "PAYROLL", link,
                saved.getRequestedBy() != null ? saved.getRequestedBy().getId() : null);
        return saved;
    }

    public List<com.arudra.crm.entity.PayrollRequest> payrollRequestsForEmployee(Long employeeId) {
        return payrollRequestRepository.findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(employeeId);
    }

    public List<com.arudra.crm.entity.PayrollRequest> allPayrollRequests(String status) {
        return (status == null || status.isBlank())
                ? payrollRequestRepository.findByIsDeletedFalseOrderByIdDesc()
                : payrollRequestRepository.findByStatusAndIsDeletedFalseOrderByIdDesc(status);
    }

    /**
     * Approve a pending request. An ADVANCE spawns an APPROVED {@link EmployeeAdvance} (so the existing
     * multi-month recovery engine takes over) and the request becomes CONVERTED. A LOAN_REPAYMENT / OTHER
     * simply becomes APPROVED and is absorbed by its target month's payroll run.
     */
    @Transactional
    public com.arudra.crm.entity.PayrollRequest approvePayrollRequest(Long id, User approver) {
        com.arudra.crm.entity.PayrollRequest r = payrollRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payroll request not found: " + id));
        if (!"PENDING".equalsIgnoreCase(r.getStatus())) {
            throw new IllegalStateException("Only a pending request can be approved.");
        }
        r.setApprovedBy(approver);
        r.setDecidedAt(LocalDateTime.now());
        String type = r.getRequestType() == null ? "" : r.getRequestType().toUpperCase();
        if ("ADVANCE".equals(type)) {
            EmployeeAdvance a = new EmployeeAdvance();
            a.setEmployee(r.getEmployee());
            a.setAmount(nz(r.getAmount()));
            a.setReason(r.getReason());
            a.setMonthlyRecovery(nz(r.getMonthlyRecovery()));
            a.setRecoveredAmount(BigDecimal.ZERO);
            a.setBalance(nz(r.getAmount()));
            a.setAdvanceDate(LocalDate.now());
            a.setStatus("APPROVED");
            a.setApprovedBy(approver);
            EmployeeAdvance savedAdv = advanceRepository.save(a);
            r.setConvertedAdvanceId(savedAdv.getId());
            r.setStatus("CONVERTED");
        } else if ("SET_RECOVERY".equals(type)) {
            // The employee proposed a monthly recovery plan; apply it to the target loan / advance now.
            if (r.getLoanId() != null) {
                EmployeeLoan loan = loanRepository.findById(r.getLoanId())
                        .orElseThrow(() -> new ResourceNotFoundException("Loan not found: " + r.getLoanId()));
                loan.setEmiAmount(nz(r.getAmount()));
                loanRepository.save(loan);
            } else if (r.getAdvanceId() != null) {
                EmployeeAdvance adv = advanceRepository.findById(r.getAdvanceId())
                        .orElseThrow(() -> new ResourceNotFoundException("Advance not found: " + r.getAdvanceId()));
                adv.setMonthlyRecovery(nz(r.getAmount()));
                advanceRepository.save(adv);
            } else {
                throw new IllegalStateException("Recovery-plan request has no target loan or advance.");
            }
            r.setStatus("APPLIED");
        } else {
            // LOAN_REPAYMENT / ADVANCE_REPAYMENT / OTHER — absorbed by the target month's payroll run.
            r.setStatus("APPROVED");
        }
        com.arudra.crm.entity.PayrollRequest saved = payrollRequestRepository.save(r);
        notifyEmployeeUser(r.getEmployee(), "Request Approved",
                "Your " + prettyRequestType(r.getRequestType()) + " request of " + saved.getAmount() + " was approved.");
        return saved;
    }

    @Transactional
    public com.arudra.crm.entity.PayrollRequest rejectPayrollRequest(Long id, User approver, String remarks) {
        com.arudra.crm.entity.PayrollRequest r = payrollRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payroll request not found: " + id));
        if (!"PENDING".equalsIgnoreCase(r.getStatus())) {
            throw new IllegalStateException("Only a pending request can be rejected.");
        }
        r.setStatus("REJECTED");
        r.setApprovedBy(approver);
        r.setDecidedAt(LocalDateTime.now());
        r.setAdminRemarks(remarks);
        com.arudra.crm.entity.PayrollRequest saved = payrollRequestRepository.save(r);
        notifyEmployeeUser(r.getEmployee(), "Request Rejected",
                "Your " + prettyRequestType(r.getRequestType()) + " request of " + saved.getAmount() + " was rejected."
                        + (remarks != null && !remarks.isBlank() ? " (" + remarks + ")" : ""));
        return saved;
    }

    /**
     * Absorb any APPROVED, month-targeted requests (LOAN_REPAYMENT / ADVANCE_REPAYMENT / OTHER) for this
     * employee into the given payslip. Returns {extraLoanRecovery, extraAdvanceRecovery,
     * extraOtherDeductions, extraOtherEarnings}. A loan/advance repayment reduces that balance and writes
     * a PayrollRecovery row; an OTHER DEBIT/CREDIT lands in other_deductions / other_earnings. Each applied
     * request is linked to the payslip so it is never taken twice. {@code rec} must already be persisted.
     * Runs within the caller's transaction.
     */
    private BigDecimal[] applyPayrollRequests(Long employeeId, int month, int year, SalaryRecord rec) {
        BigDecimal loanRec = BigDecimal.ZERO, advanceRec = BigDecimal.ZERO,
                otherDed = BigDecimal.ZERO, otherEarn = BigDecimal.ZERO;
        for (com.arudra.crm.entity.PayrollRequest r : payrollRequestRepository
                .findByEmployeeIdAndStatusAndAppliedSalaryRecordIdIsNullAndIsDeletedFalse(employeeId, "APPROVED")) {
            // Respect the target period if the request set one (portal always does).
            if (r.getTargetMonth() != null && r.getTargetYear() != null
                    && !(r.getTargetMonth() == month && r.getTargetYear() == year)) continue;
            String type = r.getRequestType() == null ? "" : r.getRequestType().toUpperCase();
            BigDecimal amt = nz(r.getAmount());
            if (amt.signum() <= 0) { markApplied(r, rec); continue; }

            if ("LOAN_REPAYMENT".equals(type)) {
                EmployeeLoan loan = r.getLoanId() == null ? null : loanRepository.findById(r.getLoanId()).orElse(null);
                if (loan != null && "ACTIVE".equalsIgnoreCase(loan.getStatus()) && nz(loan.getBalance()).signum() > 0) {
                    BigDecimal take = amt.min(loan.getBalance());
                    loan.setRecoveredAmount(nz(loan.getRecoveredAmount()).add(take));
                    loan.setBalance(loan.getBalance().subtract(take));
                    if (loan.getBalance().signum() <= 0) loan.setStatus("CLOSED");
                    loanRepository.save(loan);
                    recoveryRepository.save(recovery(rec, "LOAN", loan.getId(), take));
                    loanRec = loanRec.add(take);
                } else {
                    otherDed = otherDed.add(amt); // no live loan — still apply the approved amount
                }
            } else if ("ADVANCE_REPAYMENT".equals(type)) {
                EmployeeAdvance adv = r.getAdvanceId() == null ? null : advanceRepository.findById(r.getAdvanceId()).orElse(null);
                if (adv != null && nz(adv.getBalance()).signum() > 0) {
                    BigDecimal take = amt.min(adv.getBalance());
                    adv.setRecoveredAmount(nz(adv.getRecoveredAmount()).add(take));
                    adv.setBalance(adv.getBalance().subtract(take));
                    adv.setStatus(adv.getBalance().signum() <= 0 ? "RECOVERED" : "RECOVERING");
                    advanceRepository.save(adv);
                    recoveryRepository.save(recovery(rec, "ADVANCE", adv.getId(), take));
                    advanceRec = advanceRec.add(take);
                } else {
                    otherDed = otherDed.add(amt); // no live advance — still apply the approved amount
                }
            } else if ("CREDIT".equalsIgnoreCase(r.getDirection())) {
                otherEarn = otherEarn.add(amt);
            } else {
                otherDed = otherDed.add(amt);
            }
            markApplied(r, rec);
        }
        return new BigDecimal[]{loanRec, advanceRec, otherDed, otherEarn};
    }

    private void markApplied(com.arudra.crm.entity.PayrollRequest r, SalaryRecord rec) {
        r.setStatus("APPLIED");
        r.setAppliedSalaryRecordId(rec.getId());
        payrollRequestRepository.save(r);
    }

    private static String prettyRequestType(String type) {
        if (type == null) return "payroll";
        switch (type.toUpperCase()) {
            case "ADVANCE": return "salary advance";
            case "LOAN_REPAYMENT": return "loan repayment";
            case "ADVANCE_REPAYMENT": return "advance repayment";
            case "SET_RECOVERY": return "recovery-plan";
            case "OTHER": return "payroll adjustment";
            default: return type.toLowerCase();
        }
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

        // Employee-raised, approved requests for this month (extra loan/advance repayment, other debit/credit).
        BigDecimal[] req = applyPayrollRequests(employeeId, month, year, rec);
        loanRecovery = loanRecovery.add(req[0]);
        advanceRecovery = advanceRecovery.add(req[1]);
        BigDecimal otherDeductions = req[2];
        BigDecimal otherEarnings = req[3];
        BigDecimal finalGross = grossEarnings.add(otherEarnings);

        BigDecimal totalDeductions = pf.add(esi).add(pt).add(leaveDeduction)
                .add(advanceRecovery).add(loanRecovery).add(otherDeductions);
        rec.setAdvanceRecovery(advanceRecovery);
        rec.setLoanRecovery(loanRecovery);
        rec.setOtherEarnings(otherEarnings);
        rec.setOtherDeductions(otherDeductions);
        rec.setGrossEarnings(finalGross);
        rec.setTotalDeductions(totalDeductions);
        rec.setDeductions(totalDeductions); // legacy aggregate field kept in sync
        rec.setNetSalary(finalGross.subtract(totalDeductions));
        return salaryRepository.save(rec);
    }

    /**
     * The single pay basis an employee belongs to, so the hourly and monthly bulk runs cover disjoint
     * sets (no employee is generated by both). An explicit {@code salaryType} wins — only "HOURLY" is
     * hourly, anything else (MONTHLY/DAILY) is monthly. When it's unset, we infer: an employee with an
     * hourly rate on file is hourly, otherwise monthly. This keeps existing data working without forcing
     * every employee's basis to be set first.
     */
    private static boolean isHourlyBasis(Employee e) {
        String t = e.getSalaryType();
        if (t != null && !t.isBlank()) return "HOURLY".equalsIgnoreCase(t);
        return e.getHourlyRate() != null;
    }

    @Transactional
    public Map<String, Object> runPayrollBulk(int month, int year) {
        int done = 0, skipped = 0;
        List<String> errors = new ArrayList<>();
        for (Employee e : employeeRepository.findByPayrollEnabledTrueAndIsDeletedFalse()) {
            // Monthly run: only monthly-basis employees. Hourly-basis employees are paid by the hourly run.
            if (isHourlyBasis(e)) { skipped++; continue; }
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

        // Employee-raised, approved requests for this month (extra loan/advance repayment, other debit/credit).
        BigDecimal[] req = applyPayrollRequests(employeeId, month, year, rec);
        loanRecovery = loanRecovery.add(req[0]);
        advanceRecovery = advanceRecovery.add(req[1]);
        BigDecimal reqOtherDed = req[2];
        BigDecimal reqOtherEarn = req[3];

        BigDecimal gross = regularEarnings.add(overtimeEarnings).add(projectBonus).add(manualBonus)
                .add(incentive).add(reqOtherEarn);
        BigDecimal totalDeductions = manualDeduction.add(advanceRecovery).add(loanRecovery).add(reqOtherDed);
        rec.setProjectBonus(projectBonus);
        rec.setManualBonus(manualBonus);
        rec.setBonus(projectBonus.add(manualBonus));
        rec.setIncentive(incentive);
        rec.setOtherEarnings(reqOtherEarn);
        rec.setGrossEarnings(gross);
        rec.setManualDeduction(manualDeduction);
        rec.setOtherDeductions(manualDeduction.add(reqOtherDed));
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
            // Hourly run: only hourly-basis employees. Monthly-basis employees are paid by the monthly run.
            if (!isHourlyBasis(e)) { skipped++; continue; }
            // An hourly-basis employee still needs a rate on file to compute earnings.
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
        out.put("workStats", employeeWorkStats(rec.getEmployee() != null ? rec.getEmployee().getId() : null));
        return out;
    }

    /**
     * How much this employee has actually delivered: number of tasks they completed, and the number of
     * distinct projects they finished at least one task on (project status irrelevant — the chosen
     * definition). Employees are linked to their login (which owns TaskAssignments) by email.
     */
    public Map<String, Object> employeeWorkStats(Long employeeId) {
        Map<String, Object> m = new LinkedHashMap<>();
        long tasksDone = 0, projectsDone = 0;
        Employee employee = employeeId == null ? null : employeeRepository.findById(employeeId).orElse(null);
        User user = employee != null && employee.getEmail() != null
                ? userRepository.findByEmail(employee.getEmail()).orElse(null) : null;
        if (user != null) {
            java.util.Set<Long> doneTasks = new java.util.HashSet<>();
            java.util.Set<Long> doneProjects = new java.util.HashSet<>();
            for (com.arudra.crm.entity.TaskAssignment a : taskAssignmentRepository.findByEmployeeId(user.getId())) {
                if (!"COMPLETED".equals(a.getStatus())) continue;
                com.arudra.crm.entity.Task t = a.getTask();
                if (t == null) continue;
                doneTasks.add(t.getId());
                if (t.getProject() != null) doneProjects.add(t.getProject().getId());
            }
            tasksDone = doneTasks.size();
            projectsDone = doneProjects.size();
        }
        m.put("tasksDone", tasksDone);
        m.put("projectsDone", projectsDone);
        return m;
    }

    public List<SalaryRecord> getRegister(int month, int year) {
        return salaryRepository.findByMonthAndYearOrderByIdDesc(month, year);
    }

    /**
     * Per-day attendance sheet for one employee in a month: for each day worked, the check-in/out,
     * attendance-clocked worked & overtime hours, that day's earnings, and the real time logged against
     * TASKS (from {@link TaskTimeLog}, keyed by the employee's login, resolved by email). Merges the two
     * sources by date so a day shows both what the clock captured and what was tracked on tasks.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> employeeDailyLog(Long employeeId, int month, int year) {
        Employee e = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        YearMonth ym = YearMonth.of(year, month);
        LocalDate from = ym.atDay(1), to = ym.atEndOfMonth();

        // Always derive an hourly rate so every day carries an hourly-basis earning — the same data then
        // pays either way. Hourly staff use their explicit rate; monthly staff get a rate derived from
        // their monthly gross ÷ (standard daily hours × standard working days).
        BigDecimal effRate = nz(e.getHourlyRate());
        String rateSource = effRate.signum() > 0 ? "EXPLICIT" : "NONE";
        if (effRate.signum() <= 0) {
            BigDecimal monthlyGross = BigDecimal.ZERO;
            SalaryStructure s = structureRepository.findFirstByEmployeeIdAndActiveTrueOrderByIdDesc(employeeId).orElse(null);
            if (s != null) monthlyGross = nz(s.getBasic()).add(nz(s.getHra())).add(nz(s.getAllowances())).add(nz(s.getSpecialAllowance()));
            if (monthlyGross.signum() <= 0) monthlyGross = nz(e.getBaseSalary());
            BigDecimal stdDaily = e.getStandardDailyHours() != null && e.getStandardDailyHours().signum() > 0
                    ? e.getStandardDailyHours() : new BigDecimal("8");
            BigDecimal denom = stdDaily.multiply(BigDecimal.valueOf(STANDARD_WORKING_DAYS));
            if (monthlyGross.signum() > 0 && denom.signum() > 0) {
                effRate = monthlyGross.divide(denom, 2, RoundingMode.HALF_UP);
                rateSource = "DERIVED";
            }
        }
        BigDecimal otRate = e.getOvertimeRate() != null && e.getOvertimeRate().signum() > 0
                ? e.getOvertimeRate()
                : effRate.multiply(e.getOvertimeMultiplier() != null && e.getOvertimeMultiplier().signum() > 0
                        ? e.getOvertimeMultiplier() : new BigDecimal("1.5"));

        // Real task time per day, broken down per task (via the linked login).
        // taskByDate: date -> (taskId -> [workMin, otMin]); taskMeta: taskId -> {taskName, projectName}.
        Map<LocalDate, Map<Long, long[]>> taskByDate = new HashMap<>();
        Map<Long, String[]> taskMeta = new HashMap<>();
        User user = e.getEmail() != null ? userRepository.findByEmail(e.getEmail()).orElse(null) : null;
        if (user != null) {
            for (TaskTimeLog l : taskTimeLogRepository
                    .findByEmployeeIdAndWorkDateBetweenOrderByWorkDateDescIdDesc(user.getId(), from, to)) {
                if (l.getWorkDate() == null) continue;
                Task t = l.getTask();
                Long tid = t != null ? t.getId() : -1L;
                taskMeta.computeIfAbsent(tid, k -> new String[]{
                        t != null ? t.getTaskName() : "Task",
                        t != null && t.getProject() != null ? t.getProject().getProjectName() : null });
                long[] agg = taskByDate.computeIfAbsent(l.getWorkDate(), k -> new HashMap<>())
                        .computeIfAbsent(tid, k -> new long[2]);
                agg[0] += l.getWorkingTimeMinutes() == null ? 0 : l.getWorkingTimeMinutes();
                agg[1] += l.getOvertimeMinutes() == null ? 0 : l.getOvertimeMinutes();
            }
        }

        // Union of dates from attendance + task logs, newest first.
        Map<LocalDate, Attendance> attMap = new HashMap<>();
        Set<LocalDate> dates = new TreeSet<>(Comparator.reverseOrder());
        for (Attendance a : attendanceRepository.findByEmployeeIdAndDateBetween(employeeId, from, to)) {
            attMap.put(a.getDate(), a);
            dates.add(a.getDate());
        }
        dates.addAll(taskByDate.keySet());

        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal totWorked = BigDecimal.ZERO, totOt = BigDecimal.ZERO, totEarn = BigDecimal.ZERO;
        long totTaskMin = 0;
        for (LocalDate day : dates) {
            Attendance a = attMap.get(day);
            BigDecimal worked = a != null ? nz(a.getWorkedHours()) : BigDecimal.ZERO;
            BigDecimal ot = a != null ? nz(a.getOvertimeHours()) : BigDecimal.ZERO;
            // Hourly staff carry an exact stored day-earning; for anyone else (monthly), compute it on the
            // hourly basis from worked hours × the derived rate so the day still shows an earning.
            BigDecimal earn = a != null ? nz(a.getDayEarnings()) : BigDecimal.ZERO;
            if (earn.signum() <= 0 && effRate.signum() > 0 && worked.signum() > 0) {
                BigDecimal reg = worked.subtract(ot).max(BigDecimal.ZERO);
                earn = reg.multiply(effRate).add(ot.multiply(otRate)).setScale(2, RoundingMode.HALF_UP);
            }

            // Per-task breakdown for the day, biggest first.
            long dayTaskMin = 0;
            List<Map<String, Object>> taskList = new ArrayList<>();
            for (Map.Entry<Long, long[]> te : taskByDate.getOrDefault(day, Map.of()).entrySet()) {
                long[] agg = te.getValue();
                dayTaskMin += agg[0];
                String[] meta = taskMeta.get(te.getKey());
                Map<String, Object> tm = new LinkedHashMap<>();
                tm.put("taskId", te.getKey());
                tm.put("taskName", meta != null ? meta[0] : "Task");
                tm.put("project", meta != null ? meta[1] : null);
                tm.put("minutes", agg[0]);
                tm.put("hours", BigDecimal.valueOf(agg[0]).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP));
                taskList.add(tm);
            }
            taskList.sort((x, y) -> Long.compare((long) y.get("minutes"), (long) x.get("minutes")));

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", day);
            row.put("status", a != null ? a.getStatus() : "—");
            row.put("checkIn", a != null ? a.getCheckInTime() : null);
            row.put("checkOut", a != null ? a.getCheckOutTime() : null);
            row.put("workedHours", worked);
            row.put("overtimeHours", ot);
            row.put("dayEarnings", earn);
            row.put("taskMinutes", dayTaskMin);
            row.put("taskHours", BigDecimal.valueOf(dayTaskMin).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP));
            row.put("tasks", taskList);
            rows.add(row);

            totWorked = totWorked.add(worked);
            totOt = totOt.add(ot);
            totEarn = totEarn.add(earn);
            totTaskMin += dayTaskMin;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("month", month);
        out.put("year", year);
        out.put("rows", rows);
        out.put("totalWorkedHours", totWorked.setScale(2, RoundingMode.HALF_UP));
        out.put("totalOvertimeHours", totOt.setScale(2, RoundingMode.HALF_UP));
        out.put("totalEarnings", totEarn.setScale(2, RoundingMode.HALF_UP));
        out.put("totalTaskHours", BigDecimal.valueOf(totTaskMin).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP));
        out.put("daysWorked", rows.size());
        out.put("effectiveHourlyRate", effRate.setScale(2, RoundingMode.HALF_UP));
        out.put("rateSource", rateSource); // EXPLICIT (hourly staff) | DERIVED (from monthly salary) | NONE
        return out;
    }

    /**
     * Workforce cash-flow for a month: what was actually PAID OUT by category (salaries, advances, loans,
     * direct bonuses, contractor payments) versus what is currently OWED (unpaid payslips, advance & loan
     * balances, contractor outstanding & overdue). Bonuses absorbed into a payslip are excluded from the
     * bonus line to avoid double-counting the salary net.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> cashflow(int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate from = ym.atDay(1), to = ym.atEndOfMonth();
        LocalDateTime fromDt = from.atStartOfDay(), toDt = to.atTime(23, 59, 59);

        // ---- Paid out in the period (with the detail records for the list) ----
        List<SalaryRecord> paidSalaries = salaryRepository.findByStatusAndPaymentDateBetween("PAID", from, to);
        List<ContractorPayment> conPayments = paymentRepository.findByStatusAndPaymentDateBetween("PAID", from, to);
        List<EmployeeAdvance> advList = advanceRepository
                .findByAdvanceDateBetweenAndStatusNotInOrderByAdvanceDateDesc(from, to, List.of("PENDING", "REJECTED"));
        List<EmployeeLoan> loanList = loanRepository.findByDisbursedDateBetweenOrderByDisbursedDateDesc(from, to);
        List<EmployeeBonus> bonusList = bonusRepository.findDirectPaidBetween(fromDt, toDt);

        BigDecimal salaries = BigDecimal.ZERO;
        for (SalaryRecord r : paidSalaries) salaries = salaries.add(nz(r.getNetSalary()));
        BigDecimal contractors = BigDecimal.ZERO;
        for (ContractorPayment p : conPayments) contractors = contractors.add(nz(p.getAmount()));
        BigDecimal advances = BigDecimal.ZERO;
        for (EmployeeAdvance a : advList) advances = advances.add(nz(a.getAmount()));
        BigDecimal loans = BigDecimal.ZERO;
        for (EmployeeLoan l : loanList) loans = loans.add(nz(l.getPrincipal()));
        BigDecimal bonuses = BigDecimal.ZERO;
        for (EmployeeBonus b : bonusList) bonuses = bonuses.add(nz(b.getAmount()));
        BigDecimal totalPaid = salaries.add(advances).add(loans).add(bonuses).add(contractors);

        Map<String, Object> paid = new LinkedHashMap<>();
        paid.put("salaries", salaries);
        paid.put("advances", advances);
        paid.put("loans", loans);
        paid.put("bonuses", bonuses);
        paid.put("contractors", contractors);
        paid.put("total", totalPaid);

        // ---- Money IN this period — advance/loan recovered from the salaries paid this month ----
        BigDecimal advRecovered = BigDecimal.ZERO, loanRecovered = BigDecimal.ZERO;
        for (SalaryRecord r : paidSalaries) {
            advRecovered = advRecovered.add(nz(r.getAdvanceRecovery()));
            loanRecovered = loanRecovered.add(nz(r.getLoanRecovery()));
        }
        Map<String, Object> moneyIn = new LinkedHashMap<>();
        moneyIn.put("advanceRecovery", advRecovered);
        moneyIn.put("loanRecovery", loanRecovered);
        moneyIn.put("total", advRecovered.add(loanRecovered));

        // ---- Owed, scoped to the selected month (anchored to when each item was booked) ----
        BigDecimal salaryDue = nz(salaryRepository.sumNetByMonthYearAndStatus(month, year, "PENDING"))
                .add(nz(salaryRepository.sumNetByMonthYearAndStatus(month, year, "APPROVED")));
        BigDecimal advOut = nz(advanceRepository.sumBalanceGivenBetween(from, to));      // advances given this month, still owed
        BigDecimal loanOut = nz(loanRepository.sumBalanceDisbursedBetween(from, to));    // loans disbursed this month, still owed
        BigDecimal conOut = nz(billRepository.sumOutstandingBetween(from, to));          // bills dated this month, still unpaid
        BigDecimal totalOwed = salaryDue.add(advOut).add(loanOut).add(conOut);

        Map<String, Object> owed = new LinkedHashMap<>();
        owed.put("salaryDue", salaryDue);
        owed.put("advancesOutstanding", advOut);
        owed.put("loansOutstanding", loanOut);
        owed.put("contractorOutstanding", conOut);
        owed.put("total", totalOwed);

        // ---- Detail list: one row per payment made in the period ----
        List<Map<String, Object>> txns = new ArrayList<>();
        for (SalaryRecord r : paidSalaries)
            txns.add(txn(r.getPaymentDate(), "SALARY", "EMPLOYEE",
                    r.getEmployee() != null ? r.getEmployee().getId() : null, empFullName(r.getEmployee()),
                    nz(r.getNetSalary()), r.getPayslipNumber()));
        for (EmployeeAdvance a : advList)
            txns.add(txn(a.getAdvanceDate(), "ADVANCE", "EMPLOYEE",
                    a.getEmployee() != null ? a.getEmployee().getId() : null, empFullName(a.getEmployee()),
                    nz(a.getAmount()), a.getReason()));
        for (EmployeeLoan l : loanList)
            txns.add(txn(l.getDisbursedDate(), "LOAN", "EMPLOYEE",
                    l.getEmployee() != null ? l.getEmployee().getId() : null, empFullName(l.getEmployee()),
                    nz(l.getPrincipal()), "Loan disbursed"));
        for (EmployeeBonus b : bonusList)
            txns.add(txn(b.getPaidAt() != null ? b.getPaidAt().toLocalDate() : null, "BONUS", "EMPLOYEE",
                    b.getEmployee() != null ? b.getEmployee().getId() : null, empFullName(b.getEmployee()),
                    nz(b.getAmount()), b.getReason()));
        for (ContractorPayment p : conPayments)
            txns.add(txn(p.getPaymentDate(), "CONTRACTOR", "CONTRACTOR",
                    p.getContractor() != null ? p.getContractor().getId() : null, conName(p.getContractor()),
                    nz(p.getAmount()), p.getPaymentType()));
        txns.sort((x, y) -> {
            LocalDate dx = (LocalDate) x.get("date"), dy = (LocalDate) y.get("date");
            if (dx == null && dy == null) return 0;
            if (dx == null) return 1;
            if (dy == null) return -1;
            return dy.compareTo(dx);
        });

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("month", month);
        out.put("year", year);
        out.put("paid", paid);
        out.put("moneyIn", moneyIn);
        out.put("owed", owed);
        out.put("transactions", txns);
        return out;
    }

    private static Map<String, Object> txn(LocalDate date, String category, String partyType,
                                           Long partyId, String party, BigDecimal amount, String reference) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("date", date);
        m.put("category", category);
        m.put("partyType", partyType);
        m.put("partyId", partyId);
        m.put("party", party);
        m.put("amount", amount);
        m.put("reference", reference);
        return m;
    }

    private static String empFullName(Employee e) {
        if (e == null) return "Employee";
        String n = ((e.getFirstName() == null ? "" : e.getFirstName()) + " "
                + (e.getLastName() == null ? "" : e.getLastName())).trim();
        return n.isEmpty() ? "Employee" : n;
    }

    private static String conName(Contractor c) {
        if (c == null) return "Contractor";
        return c.getName() != null ? c.getName() : (c.getCompanyName() != null ? c.getCompanyName() : "Contractor");
    }

    // ============================================================ unified pay run (employees + contractors)

    /**
     * One pay-run view listing every employee AND every contractor for a period, as {@link PayrollLine}s.
     * Read-only merge — it does not compute or persist money, it assembles rows from the two existing
     * engines. Employees come from their {@code SalaryRecord}s for the month; contractors are folded from
     * the bill/ledger engine under <b>Option B</b>: a contractor with an open balance shows on every period,
     * and the period columns reflect only what was billed within it. Contractor rows are never given an
     * inline pay action — their bills carry a multi-step approval ladder — only a deep-link hint.
     */
    @Transactional(readOnly = true)
    public List<PayrollLine> unifiedRegister(int month, int year) {
        List<PayrollLine> lines = new ArrayList<>();
        for (SalaryRecord r : salaryRepository.findByMonthAndYearOrderByIdDesc(month, year)) {
            lines.add(employeeLine(r, month, year));
        }
        lines.addAll(contractorLines(month, year));
        return lines;
    }

    /** Combined counts + payout totals across both groups for the period — powers the pay-run header. */
    @Transactional(readOnly = true)
    public Map<String, Object> payrollSummary(int month, int year) {
        List<PayrollLine> lines = unifiedRegister(month, year);
        int employees = 0, contractors = 0, toApprove = 0, toPay = 0, paid = 0;
        BigDecimal employeeNet = BigDecimal.ZERO, contractorOutstanding = BigDecimal.ZERO;
        for (PayrollLine l : lines) {
            if ("EMPLOYEE".equals(l.getResourceType())) {
                employees++;
                employeeNet = employeeNet.add(nz(l.getPayable()));
                switch (nzs(l.getStatus())) {
                    case "PENDING" -> toApprove++;
                    case "APPROVED" -> toPay++;
                    case "PAID" -> paid++;
                    default -> { }
                }
            } else {
                contractors++;
                contractorOutstanding = contractorOutstanding.add(nz(l.getOutstanding()));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("month", month);
        out.put("year", year);
        out.put("totalPeople", lines.size());
        out.put("employees", employees);
        out.put("contractors", contractors);
        out.put("toApprove", toApprove);
        out.put("toPay", toPay);
        out.put("paid", paid);
        out.put("employeeNetPayout", employeeNet);
        out.put("contractorOutstanding", contractorOutstanding);
        out.put("combinedPayout", employeeNet.add(contractorOutstanding));
        return out;
    }

    private PayrollLine employeeLine(SalaryRecord r, int month, int year) {
        PayrollLine l = new PayrollLine();
        l.setResourceType("EMPLOYEE");
        Employee e = r.getEmployee();
        l.setPersonId(e != null ? e.getId() : null);
        l.setName(e != null ? (nzs(e.getFirstName()) + " " + nzs(e.getLastName())).trim() : "Employee");
        l.setCode(e != null ? e.getEmployeeCode() : null);
        boolean hourly = "HOURLY".equalsIgnoreCase(r.getPayType());
        l.setPayModel(hourly ? "HOURLY" : "MONTHLY");
        l.setBasisLabel(hourly
                ? r.getAttendanceDays() + "d · " + compact(r.getWorkedHours()) + "h"
                        + (nz(r.getOvertimeHours()).signum() > 0 ? " · " + compact(r.getOvertimeHours()) + " OT" : "")
                : compact(r.getPaidDays() != null ? r.getPaidDays() : r.getWorkingDays()) + " days");
        l.setGross(r.getGrossEarnings());
        l.setDeductions(r.getTotalDeductions());
        l.setPayable(r.getNetSalary());
        l.setStatus(r.getStatus());
        l.setRecordId(r.getId());
        l.setActionHint("PENDING".equals(r.getStatus()) ? "APPROVE"
                : "APPROVED".equals(r.getStatus()) ? "PAY" : "VIEW");
        l.setMonth(month);
        l.setYear(year);
        return l;
    }

    /** Fold the contractor bill/ledger engine into one line per contractor (Option B). */
    private List<PayrollLine> contractorLines(int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate from = ym.atDay(1), to = ym.atEndOfMonth();

        // Group every live, non-draft bill by its contractor (DRAFT/REJECTED/CANCELLED don't owe money).
        Map<Long, List<ContractorBill>> byContractor = new LinkedHashMap<>();
        Map<Long, Contractor> contractors = new LinkedHashMap<>();
        for (ContractorBill b : billRepository.findAll()) {
            if (Boolean.TRUE.equals(b.getIsDeleted())) continue;
            String st = b.getStatus();
            if ("REJECTED".equals(st) || "CANCELLED".equals(st) || "DRAFT".equals(st)) continue;
            Contractor c = b.getContractor();
            if (c == null) continue;
            byContractor.computeIfAbsent(c.getId(), k -> new ArrayList<>()).add(b);
            contractors.putIfAbsent(c.getId(), c);
        }

        List<PayrollLine> lines = new ArrayList<>();
        for (Map.Entry<Long, List<ContractorBill>> entry : byContractor.entrySet()) {
            BigDecimal outstanding = BigDecimal.ZERO, periodGross = BigDecimal.ZERO, periodRetention = BigDecimal.ZERO;
            BigDecimal billedTotal = BigDecimal.ZERO, paidToDate = BigDecimal.ZERO;
            int periodBills = 0;
            boolean anyPayable = false;
            for (ContractorBill b : entry.getValue()) {
                outstanding = outstanding.add(nz(b.getBalanceAmount()));
                billedTotal = billedTotal.add(nz(b.getNetAmount()));
                paidToDate = paidToDate.add(nz(b.getPaidAmount()));
                boolean inPeriod = b.getBillDate() != null
                        && !b.getBillDate().isBefore(from) && !b.getBillDate().isAfter(to);
                if (inPeriod) {
                    periodGross = periodGross.add(nz(b.getNetAmount()));
                    periodRetention = periodRetention.add(nz(b.getRetentionAmount()));
                    periodBills++;
                }
                if (("FINANCE_APPROVED".equals(b.getStatus()) || "PARTIALLY_PAID".equals(b.getStatus()))
                        && nz(b.getBalanceAmount()).signum() > 0) anyPayable = true;
            }

            // Option B: include a contractor whenever money is owed, or there was activity this period.
            if (outstanding.signum() <= 0 && periodBills == 0) continue;

            Contractor c = contractors.get(entry.getKey());
            PayrollLine l = new PayrollLine();
            l.setResourceType("CONTRACTOR");
            l.setPersonId(c.getId());
            l.setName(c.getName() != null ? c.getName() : c.getCompanyName());
            l.setCode(c.getContractorCode());
            l.setPayModel("CONTRACT");
            l.setBasisLabel(periodBills > 0
                    ? periodBills + (periodBills == 1 ? " bill this period" : " bills this period")
                    : "running balance");
            l.setGross(periodBills > 0 ? periodGross : null);
            l.setDeductions(periodBills > 0 && periodRetention.signum() > 0 ? periodRetention : null);
            l.setPayable(outstanding.signum() > 0 ? outstanding : periodGross);
            l.setOutstanding(outstanding);
            l.setBilledTotal(billedTotal);
            l.setPaidToDate(paidToDate);
            if (outstanding.signum() <= 0) { l.setStatus("PAID"); l.setActionHint("LEDGER"); }
            else if (anyPayable) { l.setStatus("DUE"); l.setActionHint("OPEN_BILL"); }
            else { l.setStatus("PENDING"); l.setActionHint("OPEN_BILL"); }
            l.setMonth(month);
            l.setYear(year);
            lines.add(l);
        }
        lines.sort((a, b) -> nz(b.getPayable()).compareTo(nz(a.getPayable())));
        return lines;
    }

    /** Compact a BigDecimal for a label ("8", "8.5"), avoiding the stripTrailingZeros zero quirk. */
    private static String compact(BigDecimal v) {
        if (v == null || v.signum() == 0) return "0";
        return v.stripTrailingZeros().toPlainString();
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

    /**
     * Flip an employee's pay basis (HOURLY ↔ MONTHLY) in one call, touching nothing else — used by the
     * inline basis toggle on the payroll page. Only affects future payroll runs; an already-generated
     * payslip for the current month is unchanged.
     */
    @Transactional
    public Employee setPayBasis(Long employeeId, String salaryType) {
        Employee e = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + employeeId));
        String t = salaryType == null ? "" : salaryType.trim().toUpperCase();
        if (!"HOURLY".equals(t) && !"MONTHLY".equals(t)) {
            throw new IllegalArgumentException("Pay basis must be HOURLY or MONTHLY.");
        }
        e.setSalaryType(t);
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
