package com.arudra.crm.controller;

import com.arudra.crm.entity.AttendanceLocation;
import com.arudra.crm.entity.User;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.AttendanceAdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin/HR management of attendance verification: office geofences and review of flagged clock-ins.
 * Scoped to the same authorities as the rest of core HR data.
 */
@RestController
@RequestMapping("/api/hr/attendance")
@CrossOrigin(origins = "*")
public class AttendanceAdminController {

    private static final String HR_READ =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";

    @Autowired private AttendanceAdminService adminService;
    @Autowired private com.arudra.crm.service.AttendanceCorrectionService correctionService;
    @Autowired private CurrentUserService currentUserService;

    // --- office geofences --------------------------------------------------

    @GetMapping("/locations")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<AttendanceLocation>> listLocations() {
        return ResponseEntity.ok(adminService.listLocations());
    }

    @PostMapping("/locations")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<AttendanceLocation> saveLocation(@RequestBody AttendanceLocation body) {
        return ResponseEntity.ok(adminService.saveLocation(body));
    }

    @DeleteMapping("/locations/{id}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> deleteLocation(@PathVariable Long id) {
        adminService.deleteLocation(id);
        return ResponseEntity.noContent().build();
    }

    // --- flagged-clock-in review ------------------------------------------

    @GetMapping("/pending")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> pending() {
        return ResponseEntity.ok(adminService.listPending());
    }

    @PostMapping("/sessions/{id}/approve")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> approve(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.resolve(id, true, actor()));
    }

    @PostMapping("/sessions/{id}/reject")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> reject(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.resolve(id, false, actor()));
    }

    // --- biometric method-change requests ----------------------------------

    @GetMapping("/method-requests")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> methodRequests() {
        return ResponseEntity.ok(adminService.listMethodRequests());
    }

    @PostMapping("/method-requests/{employeeId}/approve")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> approveMethodRequest(@PathVariable Long employeeId) {
        adminService.resolveMethodRequest(employeeId, true);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/method-requests/{employeeId}/reject")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> rejectMethodRequest(@PathVariable Long employeeId) {
        adminService.resolveMethodRequest(employeeId, false);
        return ResponseEntity.noContent().build();
    }

    // --- attendance time-correction requests -------------------------------

    @GetMapping("/corrections")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> corrections() {
        return ResponseEntity.ok(correctionService.listPending());
    }

    @PostMapping("/corrections/{id}/approve")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> approveCorrection(@PathVariable Long id) {
        return ResponseEntity.ok(correctionService.approve(id, actor()));
    }

    @PostMapping("/corrections/{id}/reject")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> rejectCorrection(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        String remarks = body == null ? null : body.get("remarks");
        return ResponseEntity.ok(correctionService.reject(id, actor(), remarks));
    }

    /** Admin applies a correction directly (edit a day's times or add a missed day) — no request. */
    @PostMapping("/corrections/apply")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> applyCorrection(@RequestBody Map<String, String> body) {
        Long employeeId = Long.valueOf(body.get("employeeId"));
        java.time.LocalDate date = java.time.LocalDate.parse(body.get("date").trim());
        correctionService.adminApplyDay(employeeId, date,
                EmployeePortalController.parseTime(body.get("checkIn")),
                EmployeePortalController.parseTime(body.get("checkOut")));
        return ResponseEntity.noContent().build();
    }

    private String actor() {
        User u = currentUserService.getCurrentUser();
        return u == null ? null : u.getEmail();
    }
}
