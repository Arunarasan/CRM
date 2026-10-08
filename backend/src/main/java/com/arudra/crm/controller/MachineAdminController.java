package com.arudra.crm.controller;

import com.arudra.crm.entity.User;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.MachineAdminService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** HR management of office fingerprint machines. Raw payloads (no ApiResponse envelope), like the rest of /api/hr/attendance. */
@RestController
@RequestMapping("/api/hr/attendance/machines")
@CrossOrigin(origins = "*")
public class MachineAdminController {

    private static final String HR_READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";

    private final MachineAdminService adminService;
    private final CurrentUserService currentUserService;

    public MachineAdminController(MachineAdminService adminService, CurrentUserService currentUserService) {
        this.adminService = adminService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> list() {
        return ResponseEntity.ok(adminService.listMachines());
    }

    @PostMapping
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> create(@RequestBody MachineAdminService.MachineInput body) {
        return ResponseEntity.ok(adminService.saveMachine(null, body));
    }

    @PutMapping("/{id}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> update(@PathVariable Long id, @RequestBody MachineAdminService.MachineInput body) {
        return ResponseEntity.ok(adminService.saveMachine(id, body));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        adminService.deleteMachine(id, actor());
        return ResponseEntity.noContent().build();
    }

    /** Unregistered machines that tried to connect. */
    @GetMapping("/connection-requests")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> connectionRequests() {
        return ResponseEntity.ok(adminService.listConnectionRequests());
    }

    @PostMapping("/connection-requests/{id}/dismiss")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> dismiss(@PathVariable Long id) {
        adminService.dismissConnectionRequest(id);
        return ResponseEntity.noContent().build();
    }

    /** Machine IDs with punches but no linked employee. */
    @GetMapping("/unmatched")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> unmatched() {
        return ResponseEntity.ok(adminService.listUnmatchedPins());
    }

    /** Set / clear an employee's machine ID: body {"machinePin": "1023"}. Links earlier punches under that ID. */
    @PutMapping("/employees/{employeeId}/pin")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> setPin(@PathVariable Long employeeId, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(adminService.setEmployeePin(employeeId, body == null ? null : body.get("machinePin")));
    }

    /** Re-run the pairing for one employee: body {"employeeId": "5", "from": "2026-10-01", "to": "2026-10-09"}. */
    @PostMapping("/reprocess")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> reprocess(@RequestBody Map<String, String> body) {
        if (body == null || body.get("employeeId") == null || body.get("from") == null || body.get("to") == null) {
            throw new IllegalArgumentException("employeeId, from and to are required.");
        }
        adminService.reprocess(Long.valueOf(body.get("employeeId")), LocalDate.parse(body.get("from")), LocalDate.parse(body.get("to")));
        return ResponseEntity.ok(Map.of("reprocessed", true));
    }

    @GetMapping("/punches")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> punches(
            @RequestParam(required = false) Long machineId,
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "200") int limit) {
        return ResponseEntity.ok(adminService.searchPunches(machineId, employeeId, from, to, limit));
    }

    private String actor() {
        User u = currentUserService.getCurrentUser();
        return u == null ? null : u.getEmail();
    }
}
