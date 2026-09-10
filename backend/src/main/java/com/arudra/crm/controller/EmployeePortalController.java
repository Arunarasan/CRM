package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.GoodsReceiptSubmission;
import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.EmployeePortalService;
import com.arudra.crm.service.EmployeeTimeService;
import com.arudra.crm.service.ProfileChangeRequestService;
import com.arudra.crm.service.PurchaseService;
import com.arudra.crm.service.WebAuthnService;
import com.arudra.crm.service.AttendanceCorrectionService;

import java.time.LocalTime;
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
    private final PurchaseService purchaseService;
    private final ProfileChangeRequestService profileChangeRequestService;
    private final WebAuthnService webAuthnService;
    private final AttendanceCorrectionService correctionService;

    public EmployeePortalController(EmployeePortalService portalService, EmployeeTimeService timeService,
                                    CurrentUserService currentUserService, PurchaseService purchaseService,
                                    ProfileChangeRequestService profileChangeRequestService,
                                    WebAuthnService webAuthnService, AttendanceCorrectionService correctionService) {
        this.portalService = portalService;
        this.timeService = timeService;
        this.currentUserService = currentUserService;
        this.purchaseService = purchaseService;
        this.profileChangeRequestService = profileChangeRequestService;
        this.webAuthnService = webAuthnService;
        this.correctionService = correctionService;
    }

    /** Lenient parse of "HH:mm" or "HH:mm:ss" clock strings; null/blank -> null. */
    static LocalTime parseTime(String t) {
        if (t == null || t.isBlank()) return null;
        String s = t.trim();
        return LocalTime.parse(s.length() == 5 ? s + ":00" : s);
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

    // =====================================================================
    // Goods receipt — any employee can receive & approve incoming goods; the
    // approval is logged for the admin (see PurchaseService.approveGrn).
    // =====================================================================

    @GetMapping("/goods-receipts/incoming")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> incomingGoods() {
        me(); // ensure authenticated
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getIncomingForReceipt()));
    }

    @GetMapping("/goods-receipts/warehouses")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> receiptWarehouses() {
        me();
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getReceiptWarehouses()));
    }

    @PostMapping("/goods-receipts/receive")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<GoodsReceiptNote>> receiveGoods(@RequestBody GoodsReceiptSubmission submission) {
        me();
        return ResponseEntity.ok(ApiResponse.success(purchaseService.receiveAndApprove(submission, "PORTAL")));
    }

    @GetMapping("/goods-receipts/mine")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<GoodsReceiptNote>>> myReceipts() {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getReceiptsByUser(me().getId())));
    }

    @GetMapping("/profile")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Employee>> profile() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getProfile(me())));
    }

    /**
     * Submit profile changes for admin approval. Nothing on the master record changes until an admin
     * approves the request from the HR queue — the response is the PENDING request, not the employee.
     */
    @PutMapping("/profile")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<ProfileChangeRequest>> updateProfile(@RequestBody Map<String, String> updates) {
        return ResponseEntity.ok(ApiResponse.success(
                profileChangeRequestService.createProfileChange(me(), updates),
                "Changes submitted for approval."));
    }

    /** The employee's own change requests (profile + documents), so the portal can show pending status. */
    @GetMapping("/profile-change-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<ProfileChangeRequest>>> myChangeRequests() {
        return ResponseEntity.ok(ApiResponse.success(profileChangeRequestService.listMine(me())));
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
        public Integer accuracyMeters;
        public String locationLabel;
        public String deviceInfo;
        /** Optional WebAuthn assertion (from navigator.credentials.get) proving device biometric. */
        public AssertionBody assertion;
    }

    public static class AssertionBody {
        public String credentialId;
        public String authenticatorData;
        public String clientDataJSON;
        public String signature;
        public String userHandle;
    }

    public static class RegisterVerifyBody {
        public String attestationObject;
        public String clientDataJSON;
        public String deviceLabel;
    }

    // Each clock action returns the fresh live status snapshot (same shape as GET /time) so the
    // client always renders consistent clockedIn/onBreak/earnings state after acting.
    @PostMapping("/attendance/clock-in")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> clockIn(@RequestBody(required = false) ClockInBody body) {
        ClockInBody b = body == null ? new ClockInBody() : body;
        User u = me();
        boolean biometricVerified = false;
        if (b.assertion != null) {
            Employee emp = timeService.requireEmployee(u);
            biometricVerified = webAuthnService.verifyAssertion(emp, b.assertion.credentialId,
                    b.assertion.authenticatorData, b.assertion.clientDataJSON, b.assertion.signature, b.assertion.userHandle);
        }
        timeService.clockIn(u, b.lat, b.lng, b.accuracyMeters, b.locationLabel, b.deviceInfo, biometricVerified);
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

    // Employee opts into biometric attendance — parked for admin approval, then becomes their method.
    @PostMapping("/attendance/request-biometric")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> requestBiometric() {
        User u = me();
        timeService.requestBiometricAttendance(u);
        return ResponseEntity.ok(ApiResponse.success(timeService.getStatus(u)));
    }

    @PostMapping("/attendance/cancel-method-request")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancelMethodRequest() {
        User u = me();
        timeService.cancelMethodRequest(u);
        return ResponseEntity.ok(ApiResponse.success(timeService.getStatus(u)));
    }

    // --- attendance time-correction requests (regularization) --------------
    public static class CorrectionBody {
        public String date;      // ISO yyyy-MM-dd
        public String checkIn;   // HH:mm(:ss), optional
        public String checkOut;  // HH:mm(:ss), optional
        public String reason;
    }

    @PostMapping("/attendance/corrections")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> requestCorrection(@RequestBody CorrectionBody b) {
        LocalDate date = b.date == null || b.date.isBlank() ? null : LocalDate.parse(b.date.trim());
        correctionService.request(me(), date, parseTime(b.checkIn), parseTime(b.checkOut), b.reason);
        return ResponseEntity.ok(ApiResponse.success(Map.of("submitted", true)));
    }

    @GetMapping("/attendance/corrections")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> myCorrections() {
        return ResponseEntity.ok(ApiResponse.success(correctionService.myRequests(me())));
    }

    // --- WebAuthn (device biometric) for attendance ------------------------
    @PostMapping("/webauthn/register/options")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> webauthnRegisterOptions(
            @RequestHeader(value = "Origin", required = false) String origin) {
        return ResponseEntity.ok(ApiResponse.success(webAuthnService.registrationOptions(timeService.requireEmployee(me()), origin)));
    }

    @PostMapping("/webauthn/register/verify")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> webauthnRegisterVerify(@RequestBody RegisterVerifyBody body) {
        webAuthnService.registerVerify(timeService.requireEmployee(me()), body.attestationObject, body.clientDataJSON, body.deviceLabel);
        return ResponseEntity.ok(ApiResponse.success(Map.of("registered", true)));
    }

    @PostMapping("/webauthn/assert/options")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> webauthnAssertOptions(
            @RequestHeader(value = "Origin", required = false) String origin) {
        return ResponseEntity.ok(ApiResponse.success(webAuthnService.assertionOptions(timeService.requireEmployee(me()), origin)));
    }

    @GetMapping("/webauthn/credentials")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> webauthnCredentials() {
        return ResponseEntity.ok(ApiResponse.success(webAuthnService.listCredentials(timeService.requireEmployee(me()))));
    }

    @DeleteMapping("/webauthn/credentials/{id}")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> webauthnDeleteCredential(@PathVariable Long id) {
        webAuthnService.deleteCredential(timeService.requireEmployee(me()), id);
        return ResponseEntity.ok(ApiResponse.success(Map.of("deleted", true)));
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

    /** Month-by-month earnings preview (amount + incentive per month), computed read-only. */
    @GetMapping("/monthly-earnings")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> monthlyEarnings() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMonthlyEarnings(me())));
    }

    // --- Payroll requests (employee raises → admin approves) ----------------

    @GetMapping("/payroll-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<PayrollRequest>>> payrollRequests() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyPayrollRequests(me())));
    }

    @PostMapping("/payroll-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<PayrollRequest>> createPayrollRequest(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(portalService.createPayrollRequest(me(), body)));
    }

    /** The employee's loans (for display + raising a one-off repayment request). */
    @GetMapping("/loans")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> loans() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyLoans(me())));
    }

    /** The employee's salary advances (for display). */
    @GetMapping("/advances")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> advances() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getMyAdvances(me())));
    }

    // --- Documents ----------------------------------------------------------

    @GetMapping("/documents")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<EmployeeDocument>>> documents() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getDocuments(me())));
    }

    /** Submit a document for admin approval; it is added to the employee's file only once approved. */
    @PostMapping("/documents")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<ProfileChangeRequest>> submitDocument(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success(
                profileChangeRequestService.createDocumentRequest(me(), body),
                "Document submitted for approval."));
    }

    // --- Projects -----------------------------------------------------------

    @GetMapping("/projects")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> projects() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getProjects(me())));
    }

    /** Other active projects (not the employee's own) that have tasks they can pick up. */
    @GetMapping("/projects/other")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> otherProjects() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getOtherProjects(me())));
    }

    /** The unassigned, pickable tasks in a project. */
    @GetMapping("/projects/{projectId}/open-tasks")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> projectOpenTasks(@PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.success(portalService.getProjectOpenTasks(me(), projectId)));
    }

    /** Pick up (self-assign) an unassigned task. */
    @PostMapping("/tasks/{taskId}/pick-up")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<String>> pickUpTask(@PathVariable Long taskId) {
        portalService.pickUpTask(me(), taskId);
        return ResponseEntity.ok(ApiResponse.success("Task picked up."));
    }

    /** Join an already-owned collaborative task as a participant. */
    @PostMapping("/tasks/{taskId}/join")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<String>> joinTask(@PathVariable Long taskId) {
        portalService.joinTask(me(), taskId);
        return ResponseEntity.ok(ApiResponse.success("Joined task."));
    }

    /** The shared Task Pool — eligible AVAILABLE tasks this employee can pick up. */
    @GetMapping("/tasks/pool")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> taskPool() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getAvailablePool(me())));
    }

    /** Active-task capacity for the current employee. */
    @GetMapping("/tasks/capacity")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> taskCapacity() {
        return ResponseEntity.ok(ApiResponse.success(portalService.getTaskCapacity(me())));
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
