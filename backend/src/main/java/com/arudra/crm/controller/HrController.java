package com.arudra.crm.controller;

import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.HrService;
import com.arudra.crm.service.PayrollService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/hr")
@CrossOrigin(origins = "*")
public class HrController {

    // Payroll processing is HR/Finance/Admin; reads are broader (PM can view).
    private static final String PAYROLL_READ =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('PAYROLL_READ') or hasAuthority('WORKFORCE_READ')";
    private static final String PAYROLL_PROCESS =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('PAYROLL_PROCESS') or hasAuthority('PAYROLL_WRITE')";
    // Project Managers may recommend bonuses/OT (HR approves); processors and admins too.
    private static final String PAYROLL_RECOMMEND =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('PAYROLL_PROCESS') or hasAuthority('PAYROLL_WRITE') or hasAuthority('ROLE_PROJECT_MANAGER')";
    // Core HR data (employee PII, attendance, leave, documents, performance) is HR/management-scoped.
    private static final String HR_READ =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";

    @Autowired
    private HrService hrService;

    @Autowired
    private PayrollService payrollService;

    @Autowired
    private com.arudra.crm.service.HrOverviewService hrOverviewService;

    /** HR landing page: who's in today, what's waiting for HR, and this month's payroll — read-only. */
    @GetMapping("/overview")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> overview() {
        return ResponseEntity.ok(hrOverviewService.overview());
    }

    /** Attendance register for one day (default today): status, first in, last out, hours per person. */
    @GetMapping("/attendance/day")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> attendanceDay(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date) {
        return ResponseEntity.ok(hrOverviewService.day(date == null ? java.time.LocalDate.now() : date));
    }

    @Autowired
    private com.arudra.crm.service.PayslipEditService payslipEditService;

    @Autowired
    private com.arudra.crm.service.WorkforceAlertService workforceAlertService;

    @Autowired
    private com.arudra.crm.service.ProfileChangeRequestService profileChangeRequestService;

    @Autowired
    private CurrentUserService currentUserService;

    @Autowired
    private com.arudra.crm.service.EmployeeReviewService employeeReviewService;

    @Autowired
    private com.arudra.crm.service.GoogleBusinessReviewService googleBusinessReviewService;

    @Autowired
    private com.arudra.crm.service.GoogleReviewCountService googleReviewCountService;

    // --- Departments ---
    @GetMapping("/departments")
    public ResponseEntity<List<Department>> getDepartments() {
        return ResponseEntity.ok(hrService.getAllDepartments());
    }

    @PostMapping("/departments")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Department> createDepartment(@RequestBody Department department) {
        return ResponseEntity.ok(hrService.createDepartment(department));
    }

    // --- Employees ---
    @PostMapping("/sync-employees")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<String> syncEmployeesToUsers() {
        hrService.syncEmployeesToUsers();
        return ResponseEntity.ok("Synced employees to users successfully.");
    }

    @GetMapping("/employees")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Page<Employee>> getEmployees(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(hrService.getEmployees(page, size));
    }
    
    @GetMapping("/employees/{id}")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Employee> getEmployee(@PathVariable Long id) {
        return hrService.getEmployee(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/employees")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Employee> createEmployee(@RequestBody Employee employee) {
        return ResponseEntity.ok(hrService.createEmployee(employee));
    }

    @PutMapping("/employees/{id}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Employee> updateEmployee(@PathVariable Long id, @RequestBody Employee employee) {
        return ResponseEntity.ok(hrService.updateEmployee(id, employee));
    }

    // --- Attendance ---
    @GetMapping("/employees/{id}/attendance")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Attendance>> getAttendanceForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(hrService.getAttendanceForEmployee(id));
    }

    @PostMapping("/attendance")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Attendance> markAttendance(@RequestBody Attendance attendance) {
        return ResponseEntity.ok(hrService.markAttendance(attendance));
    }

    // --- Editable payslip (named line items on top of the auto-computed payslip) ---
    @GetMapping("/payslips")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> getEditablePayslip(
            @RequestParam Long employeeId, @RequestParam int month, @RequestParam int year) {
        return ResponseEntity.ok(payslipEditService.get(employeeId, month, year));
    }

    public static class LineItemBody {
        public String category; // EARNING | DEDUCTION
        public String label;
        public BigDecimal amount;
    }

    @PostMapping("/payslips/{recordId}/line-items")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Map<String, Object>> addPayslipLineItem(@PathVariable Long recordId, @RequestBody LineItemBody b) {
        return ResponseEntity.ok(payslipEditService.addItem(recordId, b.category, b.label, b.amount));
    }

    @PutMapping("/payslips/line-items/{itemId}")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Map<String, Object>> updatePayslipLineItem(@PathVariable Long itemId, @RequestBody LineItemBody b) {
        return ResponseEntity.ok(payslipEditService.updateItem(itemId, b.label, b.amount));
    }

    @DeleteMapping("/payslips/line-items/{itemId}")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Map<String, Object>> deletePayslipLineItem(@PathVariable Long itemId) {
        return ResponseEntity.ok(payslipEditService.deleteItem(itemId));
    }

    /** Edit the payslip's own amounts / details (earnings, deductions, hours, days, note). */
    @PutMapping("/payslips/{recordId}/components")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Map<String, Object>> updatePayslipComponents(@PathVariable Long recordId,
                                                                       @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(payslipEditService.updateComponents(recordId, body));
    }

    /** Delete an unpaid payslip and undo what generating it applied, so the month can be generated again. */
    @DeleteMapping("/payroll/{id}")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Map<String, Object>> deletePayslip(@PathVariable Long id) {
        payrollService.deletePayslip(id);
        return ResponseEntity.ok(Map.of("deleted", id));
    }

    /** Delete + generate again from current data; basis HOURLY | MONTHLY, omitted keeps the payslip's own. */
    @PostMapping("/payroll/{id}/regenerate")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<SalaryRecord> regeneratePayslip(@PathVariable Long id,
                                                          @RequestParam(required = false) String basis) {
        return ResponseEntity.ok(payrollService.regeneratePayslip(id, basis));
    }

    // --- Leaves ---
    @GetMapping("/leaves")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Page<LeaveRequest>> getLeaveRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(hrService.getLeaveRequests(page, size));
    }
    
    @GetMapping("/employees/{id}/leaves")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<LeaveRequest>> getLeaveRequestsForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(hrService.getLeaveRequestsForEmployee(id));
    }

    @PostMapping("/leaves")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<LeaveRequest> createLeaveRequest(@RequestBody LeaveRequest request) {
        return ResponseEntity.ok(hrService.createLeaveRequest(request));
    }
    
    @PostMapping("/leaves/{id}/approve")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<LeaveRequest> approveLeaveRequest(@PathVariable Long id, @RequestParam String approvedBy) {
        return ResponseEntity.ok(hrService.approveLeaveRequest(id, approvedBy));
    }
    
    @PostMapping("/leaves/{id}/reject")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<LeaveRequest> rejectLeaveRequest(@PathVariable Long id) {
        return ResponseEntity.ok(hrService.rejectLeaveRequest(id));
    }

    // --- Documents ---
    @GetMapping("/employees/{id}/documents")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<EmployeeDocument>> getDocumentsForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(hrService.getDocumentsForEmployee(id));
    }
    
    @PostMapping("/documents")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<EmployeeDocument> addDocument(@RequestBody EmployeeDocument document) {
        return ResponseEntity.ok(hrService.addDocument(document));
    }

    // --- Profile change requests (employee self-edits → admin approval) ---
    @GetMapping("/profile-change-requests")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<ProfileChangeRequest>> profileChangeRequests(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(profileChangeRequestService.listForAdmin(status));
    }

    @GetMapping("/employees/{id}/profile-change-requests")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<ProfileChangeRequest>> profileChangeRequestsForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(profileChangeRequestService.listForEmployee(id));
    }

    @PostMapping("/profile-change-requests/{id}/approve")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<ProfileChangeRequest> approveProfileChange(@PathVariable Long id) {
        return ResponseEntity.ok(profileChangeRequestService.approve(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/profile-change-requests/{id}/reject")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<ProfileChangeRequest> rejectProfileChange(@PathVariable Long id,
                                                                    @RequestBody(required = false) Map<String, String> body) {
        String remarks = body == null ? null : body.get("remarks");
        return ResponseEntity.ok(profileChangeRequestService.reject(id, currentUserService.getCurrentUser(), remarks));
    }

    // --- Employee review QR (personal review link + captured customer reviews) ---
    /** The employee's review QR token + review summary (generates a token on first read). */
    @GetMapping("/employees/{id}/review-qr")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> reviewQr(@PathVariable Long id) {
        return ResponseEntity.ok(employeeReviewService.qrInfo(id));
    }

    /** Regenerate the employee's review token (the old QR/link stops working). */
    @PostMapping("/employees/{id}/review-qr/regenerate")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> regenerateReviewQr(@PathVariable Long id) {
        return ResponseEntity.ok(employeeReviewService.regenerateToken(id));
    }

    /** Customer reviews captured for this employee (incl. hidden) + summary. */
    @GetMapping("/employees/{id}/reviews")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> employeeReviews(@PathVariable Long id) {
        return ResponseEntity.ok(employeeReviewService.listForEmployee(id));
    }

    @PatchMapping("/reviews/{reviewId}/status")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> setReviewStatus(@PathVariable Long reviewId, @RequestBody Map<String, String> body) {
        employeeReviewService.setStatus(reviewId, body.get("status"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/reviews/{reviewId}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> deleteReview(@PathVariable Long reviewId) {
        employeeReviewService.delete(reviewId);
        return ResponseEntity.ok().build();
    }

    // --- Google-review rewards: verify a scan became a real Google review, then pay a reward ---
    /** Board of every QR review sent to Google + a per-employee reward tally. */
    @GetMapping("/review-rewards")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> reviewRewards() {
        return ResponseEntity.ok(employeeReviewService.rewardsBoard());
    }

    @PostMapping("/reviews/{reviewId}/verify")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> verifyReview(@PathVariable Long reviewId,
                                                            @RequestBody(required = false) Map<String, String> body) {
        String googleReviewId = body == null ? null : body.get("googleReviewId");
        return ResponseEntity.ok(employeeReviewService.verify(reviewId, googleReviewId));
    }

    @PostMapping("/reviews/{reviewId}/unverify")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> unverifyReview(@PathVariable Long reviewId) {
        return ResponseEntity.ok(employeeReviewService.unverify(reviewId));
    }

    /** Pay the reward for a verified review — raises an incentive bonus (payslip). */
    @PostMapping("/reviews/{reviewId}/pay-reward")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Map<String, Object>> payReviewReward(@PathVariable Long reviewId) {
        return ResponseEntity.ok(employeeReviewService.payReward(reviewId, currentUserService.getCurrentUser()));
    }

    /** Auto-match captured reviews against real Google reviews (Business Profile API, if configured). */
    @PostMapping("/review-rewards/sync-google")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> syncGoogleReviews() {
        return ResponseEntity.ok(googleBusinessReviewService.suggestMatches());
    }

    /** Count-based sync: pull Google's total review count and auto-verify the oldest pending on a rise. */
    @PostMapping("/review-rewards/sync-count")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> syncReviewCount() {
        return ResponseEntity.ok(googleReviewCountService.reconcile());
    }

    /** Count-sync status for the rewards board (no external call). */
    @GetMapping("/review-rewards/count-status")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> reviewCountStatus() {
        return ResponseEntity.ok(googleReviewCountService.status());
    }

    // --- Payroll ---
    @GetMapping("/payroll")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Page<SalaryRecord>> getSalaryRecords(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(hrService.getSalaryRecords(page, size));
    }
    
    @GetMapping("/employees/{id}/payroll")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<SalaryRecord>> getSalaryRecordsForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(hrService.getSalaryRecordsForEmployee(id));
    }

    /** Delivery counts for the employee's payroll view: tasks completed + distinct projects worked. */
    @GetMapping("/employees/{id}/work-stats")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> getEmployeeWorkStats(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.employeeWorkStats(id));
    }

    /** Per-day sheet: attendance worked/OT hours, day earnings, and real task-tracked hours for a month. */
    @GetMapping("/employees/{id}/daily-log")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> employeeDailyLog(@PathVariable Long id,
                                                                @RequestParam int month,
                                                                @RequestParam int year) {
        return ResponseEntity.ok(payrollService.employeeDailyLog(id, month, year));
    }

    @PostMapping("/payroll")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<SalaryRecord> generateSalaryRecord(@RequestBody SalaryRecord record) {
        return ResponseEntity.ok(hrService.generateSalaryRecord(record));
    }
    
    @PostMapping("/payroll/{id}/pay")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<SalaryRecord> markSalaryPaid(@PathVariable Long id) {
        return ResponseEntity.ok(hrService.markSalaryPaid(id));
    }

    // --- Performance ---
    @GetMapping("/employees/{id}/performance")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<PerformanceReview>> getPerformanceReviewsForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(hrService.getPerformanceReviewsForEmployee(id));
    }
    
    @PostMapping("/performance")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<PerformanceReview> addPerformanceReview(@RequestBody PerformanceReview review) {
        return ResponseEntity.ok(hrService.addPerformanceReview(review));
    }

    /** Auto-calculated performance scorecard (attendance + tasks + reviews) for one employee. */
    @GetMapping("/employees/{id}/performance/score")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> getPerformanceScore(@PathVariable Long id) {
        return ResponseEntity.ok(hrService.computePerformance(id));
    }

    /** Performance scorecards for all employees, best first — powers the HR dashboard Performance tab. */
    @GetMapping("/performance/scores")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> getPerformanceScores() {
        return ResponseEntity.ok(hrService.getPerformanceScores());
    }

    // =====================================================================
    // Payroll (V19): advances, loans, payroll run, register,
    // payslip, finance dashboard, reports.
    // =====================================================================

    // --- Advances ---
    @GetMapping("/employees/{id}/advances")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<EmployeeAdvance>> advancesForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.advancesForEmployee(id));
    }

    @PostMapping("/employees/{id}/advances")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<EmployeeAdvance> createAdvance(@PathVariable Long id,
                                                         @RequestBody EmployeeAdvance payload) {
        return ResponseEntity.ok(payrollService.createAdvance(id, payload));
    }

    @PostMapping("/advances/{id}/approve")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<EmployeeAdvance> approveAdvance(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.approveAdvance(id, currentUserService.getCurrentUser()));
    }

    // --- Loans ---
    @GetMapping("/employees/{id}/loans")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<EmployeeLoan>> loansForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.loansForEmployee(id));
    }

    @PostMapping("/employees/{id}/loans")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<EmployeeLoan> createLoan(@PathVariable Long id, @RequestBody EmployeeLoan payload) {
        return ResponseEntity.ok(payrollService.createLoan(id, payload));
    }

    @PostMapping("/loans/{id}/close")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<EmployeeLoan> closeLoan(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.closeLoan(id));
    }

    // --- Payroll run (hours-based: pick HOURLY or MONTHLY per employee at generate time) ---
    /** Hours for the month priced both ways, per employee, for the generate screen. */
    @GetMapping("/payroll/preview")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<Map<String, Object>>> payrollPreview(@RequestParam int month, @RequestParam int year) {
        return ResponseEntity.ok(payrollService.payrollPreview(month, year));
    }

    /** Generate one employee's payslip; basis HOURLY | MONTHLY, omitted means their usual basis. */
    @PostMapping("/payroll/generate")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<SalaryRecord> generatePayslip(@RequestParam Long employeeId,
                                                        @RequestParam int month,
                                                        @RequestParam int year,
                                                        @RequestParam(required = false) String basis) {
        return ResponseEntity.ok(payrollService.generatePayslip(employeeId, month, year, basis));
    }

    /** Bulk generate. Body: { "choices": { "<employeeId>": "HOURLY" | "MONTHLY" } }; empty means everyone on usual basis. */
    @PostMapping("/payroll/generate-bulk")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Map<String, Object>> generatePayslips(@RequestParam int month, @RequestParam int year,
                                                                @RequestBody(required = false) GenerateBody body) {
        return ResponseEntity.ok(payrollService.generatePayslips(month, year, body == null ? null : body.choices));
    }

    public static class GenerateBody {
        public Map<Long, String> choices;
    }

    @PostMapping("/payroll/{id}/approve")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<SalaryRecord> approvePayroll(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.approvePayroll(id, currentUserService.getCurrentUser()));
    }

    @GetMapping("/payroll/register")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<SalaryRecord>> payrollRegister(@RequestParam int month, @RequestParam int year) {
        return ResponseEntity.ok(payrollService.getRegister(month, year));
    }

    /** Unified pay run: one row per person — every employee AND every contractor — for the period. */
    @GetMapping("/payroll/unified-register")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<com.arudra.crm.dto.payroll.PayrollLine>> unifiedRegister(
            @RequestParam int month, @RequestParam int year) {
        return ResponseEntity.ok(payrollService.unifiedRegister(month, year));
    }

    /** Combined counts + payout totals across employees and contractors for the period. */
    @GetMapping("/payroll/summary")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> payrollSummary(@RequestParam int month, @RequestParam int year) {
        return ResponseEntity.ok(payrollService.payrollSummary(month, year));
    }

    @GetMapping("/payslip/{salaryRecordId}")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> payslip(@PathVariable Long salaryRecordId) {
        return ResponseEntity.ok(payrollService.getPayslip(salaryRecordId));
    }

    @GetMapping("/finance-dashboard")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> financeDashboard() {
        return ResponseEntity.ok(payrollService.financeDashboard());
    }

    /** Workforce cash-flow for a month: paid-out by category (salary/advance/loan/bonus/contractor) vs owed. */
    @GetMapping("/cashflow")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> cashflow(@RequestParam int month, @RequestParam int year) {
        return ResponseEntity.ok(payrollService.cashflow(month, year));
    }

    @GetMapping("/payroll-reports/{type}")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Object> payrollReport(@PathVariable String type,
                                                @RequestParam(required = false) Integer month,
                                                @RequestParam(required = false) Integer year) {
        return ResponseEntity.ok(payrollService.report(type, month, year));
    }

    /** Scan and dispatch contractor payment alerts (overdue / final pending / contract closed w/ balance). */
    @PostMapping("/alerts/run")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Map<String, Object>> runAlerts() {
        return ResponseEntity.ok(workforceAlertService.runAlerts());
    }

    // ============================================================ employee bonuses

    @GetMapping("/bonuses")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<EmployeeBonus>> allBonuses(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(payrollService.allBonuses(status));
    }

    @GetMapping("/employees/{id}/bonuses")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> employeeBonuses(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.bonusSummary(id));
    }

    @PostMapping("/employees/{id}/bonuses")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<EmployeeBonus> awardBonus(@PathVariable Long id, @RequestBody EmployeeBonus body) {
        return ResponseEntity.ok(payrollService.awardBonus(id, body, currentUserService.getCurrentUser()));
    }

    @PostMapping("/bonuses/{id}/approve")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<EmployeeBonus> approveBonus(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.approveBonus(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/bonuses/{id}/pay")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<EmployeeBonus> payBonus(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.markBonusPaid(id));
    }

    // ============================================================ hourly pay register

    @GetMapping("/hourly-pay/register")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> hourlyPayRegister(@RequestParam int month, @RequestParam int year) {
        return ResponseEntity.ok(payrollService.hourlyPayRegister(month, year));
    }

    @PutMapping("/employees/{id}/hourly-rate")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Employee> setHourlyRate(@PathVariable Long id,
                                                  @RequestParam(required = false) java.math.BigDecimal hourlyRate,
                                                  @RequestParam(required = false) java.math.BigDecimal overtimeMultiplier) {
        return ResponseEntity.ok(payrollService.setHourlyRate(id, hourlyRate, overtimeMultiplier));
    }

    /** Live what-if for the Wage & basis dialog: real hours for the month priced with unsaved settings. */
    @PostMapping("/employees/{id}/wage-preview")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<Map<String, Object>> wagePreview(@PathVariable Long id, @RequestParam int month,
                                                           @RequestParam int year, @RequestBody(required = false) Employee draft) {
        return ResponseEntity.ok(payrollService.wagePreview(id, month, year, draft));
    }

    /** Full hourly wage settings (rates, multipliers, cycle, payment method, bank details). */
    @PutMapping("/employees/{id}/wage-settings")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<Employee> saveWageSettings(@PathVariable Long id, @RequestBody Employee body) {
        return ResponseEntity.ok(payrollService.saveWageSettings(id, body));
    }

    /** Project Manager recommends a bonus for an employee (RECOMMENDED → HR approves). */
    @PostMapping("/employees/{id}/bonuses/recommend")
    @PreAuthorize(PAYROLL_RECOMMEND)
    public ResponseEntity<EmployeeBonus> recommendBonus(@PathVariable Long id, @RequestBody EmployeeBonus body) {
        return ResponseEntity.ok(payrollService.recommendBonus(id, body, currentUserService.getCurrentUser()));
    }

    // ============================================================ manual deductions

    @GetMapping("/deductions")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<EmployeeDeduction>> allDeductions(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(payrollService.allDeductions(status));
    }

    @GetMapping("/employees/{id}/deductions")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<EmployeeDeduction>> deductionsForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.deductionsForEmployee(id));
    }

    @PostMapping("/employees/{id}/deductions")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<EmployeeDeduction> createDeduction(@PathVariable Long id, @RequestBody EmployeeDeduction body) {
        return ResponseEntity.ok(payrollService.createDeduction(id, body));
    }

    @PostMapping("/deductions/{id}/approve")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<EmployeeDeduction> approveDeduction(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.approveDeduction(id, currentUserService.getCurrentUser()));
    }

    // --- Employee-raised payroll requests (advance / loan repayment / other) — admin approval queue ---
    @GetMapping("/payroll-requests")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<PayrollRequest>> payrollRequests(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(payrollService.allPayrollRequests(status));
    }

    @GetMapping("/employees/{id}/payroll-requests")
    @PreAuthorize(PAYROLL_READ)
    public ResponseEntity<List<PayrollRequest>> payrollRequestsForEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.payrollRequestsForEmployee(id));
    }

    @PostMapping("/payroll-requests/{id}/approve")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<PayrollRequest> approvePayrollRequest(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.approvePayrollRequest(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/payroll-requests/{id}/reject")
    @PreAuthorize(PAYROLL_PROCESS)
    public ResponseEntity<PayrollRequest> rejectPayrollRequest(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        String remarks = body == null ? null : body.get("remarks");
        return ResponseEntity.ok(payrollService.rejectPayrollRequest(id, currentUserService.getCurrentUser(), remarks));
    }
}
