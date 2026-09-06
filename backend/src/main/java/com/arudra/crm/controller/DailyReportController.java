package com.arudra.crm.controller;

import com.arudra.crm.entity.DailyReport;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.DailyReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Admin/manager (HR) view of the employee daily-report stream. Lives under {@code /api/hr} so it
 * sits with the rest of the HR & Payroll module; returns raw entities (NOT ApiResponse-wrapped),
 * matching the other HR endpoints the frontend reads with {@code res.data} directly.
 */
@RestController
@RequestMapping("/api/hr")
@CrossOrigin(origins = "*")
public class DailyReportController {

    private static final String HR_READ =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";

    private final DailyReportService dailyReportService;
    private final CurrentUserService currentUserService;

    public DailyReportController(DailyReportService dailyReportService, CurrentUserService currentUserService) {
        this.dailyReportService = dailyReportService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/daily-reports")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<DailyReport>> list(
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long leadId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(dailyReportService.search(employeeId, projectId, leadId, status, from, to));
    }

    @GetMapping("/daily-reports/summary")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> summary() {
        return ResponseEntity.ok(dailyReportService.summary());
    }

    @GetMapping("/daily-reports/{id}")
    @PreAuthorize(HR_READ)
    public ResponseEntity<DailyReport> get(@PathVariable Long id) {
        return ResponseEntity.ok(dailyReportService.get(id));
    }

    @PostMapping("/daily-reports/{id}/review")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<DailyReport> review(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        String comment = body == null ? null : body.get("managerComment");
        return ResponseEntity.ok(dailyReportService.review(id, comment, currentUserService.getCurrentUser()));
    }

    /** Reports submitted by one employee — for the HR employee-profile "Reports" tab. */
    @GetMapping("/employees/{employeeId}/daily-reports")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<DailyReport>> forEmployee(@PathVariable Long employeeId) {
        return ResponseEntity.ok(dailyReportService.forEmployee(employeeId));
    }

    /** Leads raised by one employee — for the HR employee-profile "Leads" tab. */
    @GetMapping("/employees/{employeeId}/leads")
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> leadsForEmployee(@PathVariable Long employeeId) {
        return ResponseEntity.ok(dailyReportService.leadsForEmployee(employeeId));
    }
}
