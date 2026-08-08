package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.EmployeePortalService;
import com.arudra.crm.service.EmployeeTimeService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Employee-facing self-service portal. Everything is scoped to the employee linked to the
 * signed-in user — no endpoint here takes an employee id, so one employee cannot read another's
 * attendance, leave, salary or documents. Mirrors {@link ContractorPortalController}.
 */
@RestController
@RequestMapping("/api/employee-portal")
@CrossOrigin(origins = "*")
public class EmployeePortalController {

    private static final String PORTAL = "hasAuthority('ROLE_ADMIN') or hasAuthority('ROLE_EMPLOYEE') "
            + "or hasAuthority('EMPLOYEE_PORTAL')";

    private final EmployeePortalService portalService;
    private final EmployeeTimeService timeService;
    private final CurrentUserService currentUserService;

    public EmployeePortalController(EmployeePortalService portalService, EmployeeTimeService timeService,
                                    CurrentUserService currentUserService) {
        this.portalService = portalService;
        this.timeService = timeService;
        this.currentUserService = currentUserService;
    }

    private User me() {
        User user = currentUserService.getCurrentUser();
        if (user == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return user;
    }

    @GetMapping("/me")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Employee>> currentEmployee() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getProfile(me())));
    }

    @GetMapping("/dashboard")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getDashboard(me())));
    }

    @GetMapping("/profile")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Employee>> profile() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getProfile(me())));
    }

    @PutMapping("/profile")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Employee>> updateProfile(@RequestBody Map<String, String> updates) {
        return ResponseEntity.ok(ApiResponse.success(portalService.updateProfile(me(), updates)));
    }

    @PostMapping("/change-password")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Void>> changePassword(@RequestBody Map<String, String> body) {
        portalService.changePassword(me(), body.get("currentPassword"), body.get("newPassword"));
        return ResponseEntity.ok(ApiResponse.success(null, "Password updated."));
    }

    // --- Attendance & Time-clock -------------------------------------------

    @GetMapping("/attendance")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Attendance>>> attendance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(portalService.getAttendance(me(), from, to)));
    }

    public static class ClockInBody {
        public BigDecimal lat;
        public BigDecimal lng;
        public String locationLabel;
        public String deviceInfo;
    }

    // Each clock action returns the fresh live status snapshot (same shape as GET /time) so the
    // client always renders consistent clockedIn/onBreak/earnings state after acting.
    @PostMapping("/attendance/clock-in")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> clockIn(@RequestBody(required = false) ClockInBody body) {
        ClockInBody b = body == null ? new ClockInBody() : body;
        User u = me();
        timeService.clockIn(u, b.lat, b.lng, b.locationLabel, b.deviceInfo);
        return ResponseEntity.ok(ApiResponse.success(timeService.getStatus(u)));
    }

    @PostMapping("/attendance/clock-out")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> clockOut() {
        User u = me();
        timeService.clockOut(u);
        return ResponseEntity.ok(ApiResponse.success(timeService.getStatus(u)));
    }

    @PostMapping("/attendance/break/start")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> startBreak() {
        User u = me();
        timeService.startBreak(u);
        return ResponseEntity.ok(ApiResponse.success(timeService.getStatus(u)));
    }

    @PostMapping("/attendance/break/end")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> endBreak() {
        User u = me();
        timeService.endBreak(u);
        return ResponseEntity.ok(ApiResponse.success(timeService.getStatus(u)));
    }

    @GetMapping("/time")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> timeStatus() {
        return ResponseEntity.ok(ApiResponse.success(timeService.getStatus(me())));
    }

    @GetMapping("/earnings")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> earnings() {
        return ResponseEntity.ok(ApiResponse.success(timeService.getEarnings(me())));
    }

    @GetMapping("/timesheet")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> timesheet(
            @RequestParam(required = false, defaultValue = "MONTHLY") String period) {
        return ResponseEntity.ok(ApiResponse.success(timeService.getTimesheet(me(), period)));
    }

    // --- Leave --------------------------------------------------------------

    @GetMapping("/leaves")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<LeaveRequest>>> leaves() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getLeaves(me())));
    }

    @GetMapping("/leaves/balance")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> leaveBalance() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getLeaveBalance(me())));
    }

    @PostMapping("/leaves")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<LeaveRequest>> applyLeave(@RequestBody LeaveRequest request) {
        return ResponseEntity.ok(ApiResponse.success(portalService.applyLeave(me(), request)));
    }

    // --- Salary -------------------------------------------------------------

    @GetMapping("/salary")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> salary() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getSalarySummary(me())));
    }

    @GetMapping("/payslips")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<SalaryRecord>>> payslips() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getPayslips(me())));
    }

    @GetMapping("/payslips/{id}")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<SalaryRecord>> payslip(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(portalService.getPayslip(me(), id)));
    }

    @GetMapping("/bonuses")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> bonuses() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyBonuses(me())));
    }

    // --- Documents ----------------------------------------------------------

    @GetMapping("/documents")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<EmployeeDocument>>> documents() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getDocuments(me())));
    }

    // --- Projects -----------------------------------------------------------

    @GetMapping("/projects")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> projects() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getProjects(me())));
    }

    // --- Material Requests (own only) ---------------------------------------

    @GetMapping("/material-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<MaterialRequest>>> materialRequests() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyMaterialRequests(me())));
    }

    @GetMapping("/material-requests/{id}")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<MaterialRequest>> materialRequest(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyMaterialRequest(me(), id)));
    }

    @PostMapping("/material-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<MaterialRequest>> createMaterialRequest(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(portalService.createMaterialRequest(me(), body),
                "Material request raised."));
    }

    /** Material-master name/unit lookup for the request picker (no stock exposure). */
    @GetMapping("/materials")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> materials(
            @RequestParam(required = false, defaultValue = "") String q) {
        return ResponseEntity.ok(ApiResponse.success(portalService.searchMaterials(me(), q)));
    }

    // --- Leads (create-only + own) ------------------------------------------

    @GetMapping("/leads")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> leads() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyLeads(me())));
    }

    @PostMapping("/leads")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> createLead(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(portalService.createLead(me(), body), "Lead submitted."));
    }

    // --- Manpower Requests (own only) ---------------------------------------

    @GetMapping("/manpower-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<ManpowerRequest>>> manpowerRequests() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyManpowerRequests(me())));
    }

    @PostMapping("/manpower-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<ManpowerRequest>> createManpowerRequest(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(portalService.createManpowerRequest(me(), body),
                "Manpower request raised."));
    }

    // --- Daily Reports (own only) -------------------------------------------

    @GetMapping("/daily-reports")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<DailyReport>>> dailyReports() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyDailyReports(me())));
    }

    @PostMapping("/daily-reports")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<DailyReport>> createDailyReport(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(portalService.createDailyReport(me(), body),
                "Daily report submitted."));
    }

    // --- Personal Reminders ("Task Management", private) --------------------

    @GetMapping("/reminders")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<PersonalReminder>>> reminders() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyReminders(me())));
    }

    @PostMapping("/reminders")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<PersonalReminder>> createReminder(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(portalService.createReminder(me(), body)));
    }

    @PostMapping("/reminders/{id}/toggle")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<PersonalReminder>> toggleReminder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(portalService.toggleReminder(me(), id)));
    }

    @DeleteMapping("/reminders/{id}")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Void>> deleteReminder(@PathVariable Long id) {
        portalService.deleteReminder(me(), id);
        return ResponseEntity.ok(ApiResponse.success(null, "Reminder deleted."));
    }
}
