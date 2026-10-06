package com.arudra.crm.controller;

import com.arudra.crm.entity.AttendanceShift;
import com.arudra.crm.entity.Branch;
import com.arudra.crm.service.AttendanceReportService;
import com.arudra.crm.service.AttendanceShiftService;
import com.arudra.crm.service.BranchService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * HR → Attendance: dashboard, employee history, reports, shifts, shift/branch assignment, branches.
 * (Geofences, flagged clock-in review and corrections stay on AttendanceAdminController.)
 */
@RestController
@RequestMapping("/api/hr")
public class AttendanceInsightsController {

    private static final String HR_READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";

    private final AttendanceReportService reportService;
    private final AttendanceShiftService shiftService;
    private final BranchService branchService;

    public AttendanceInsightsController(AttendanceReportService reportService, AttendanceShiftService shiftService,
                                        BranchService branchService) {
        this.reportService = reportService;
        this.shiftService = shiftService;
        this.branchService = branchService;
    }

    // --- dashboard / history / report -----------------------------------------------------------

    @GetMapping("/attendance/dashboard")
    @PreAuthorize(HR_READ)
    public Map<String, Object> dashboard(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                         @RequestParam(required = false) Long employeeId,
                                         @RequestParam(required = false) Long departmentId,
                                         @RequestParam(required = false) Long branchId,
                                         @RequestParam(required = false) Long shiftId,
                                         @RequestParam(required = false) Long deviceId,
                                         @RequestParam(required = false) String status) {
        return reportService.dashboard(date, new AttendanceReportService.Filters(employeeId, departmentId, branchId, shiftId, deviceId, status));
    }

    @GetMapping("/attendance/today")
    @PreAuthorize(HR_READ)
    public Map<String, Object> today(@RequestParam(required = false) Long branchId) {
        return reportService.dashboard(LocalDate.now(), new AttendanceReportService.Filters(null, null, branchId, null, null, null));
    }

    @GetMapping("/attendance/history")
    @PreAuthorize(HR_READ)
    public Map<String, Object> history(@RequestParam Long employeeId,
                                       @RequestParam(required = false) Integer year,
                                       @RequestParam(required = false) Integer month) {
        LocalDate now = LocalDate.now();
        return reportService.history(employeeId, year == null ? now.getYear() : year, month == null ? now.getMonthValue() : month);
    }

    @GetMapping("/attendance/report")
    @PreAuthorize(HR_READ)
    public Map<String, Object> report(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                      @RequestParam(required = false) Long employeeId,
                                      @RequestParam(required = false) Long departmentId,
                                      @RequestParam(required = false) Long branchId,
                                      @RequestParam(required = false) Long shiftId,
                                      @RequestParam(required = false) Long deviceId,
                                      @RequestParam(required = false) String status) {
        return reportService.report(from, to, new AttendanceReportService.Filters(employeeId, departmentId, branchId, shiftId, deviceId, status));
    }

    // --- shifts ---------------------------------------------------------------------------------

    @GetMapping("/attendance/shifts")
    @PreAuthorize(HR_READ)
    public List<Map<String, Object>> shifts() {
        Map<Long, Long> counts = shiftService.assignmentCounts();
        return shiftService.list().stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("name", s.getName());
            m.put("startTime", s.getStartTime());
            m.put("endTime", s.getEndTime());
            m.put("gracePeriodMinutes", s.getGracePeriodMinutes());
            m.put("breakMinutes", s.getBreakMinutes());
            m.put("workingHours", s.getWorkingHours());
            m.put("overtimeEnabled", s.getOvertimeEnabled());
            m.put("halfDayThresholdMinutes", s.getHalfDayThresholdMinutes());
            m.put("weekOffDays", s.getWeekOffDays());
            m.put("defaultShift", s.getDefaultShift());
            m.put("active", s.getActive());
            m.put("employeeCount", counts.getOrDefault(s.getId(), 0L));
            return m;
        }).toList();
    }

    @PostMapping("/attendance/shifts")
    @PreAuthorize(HR_WRITE)
    public AttendanceShift saveShift(@RequestBody AttendanceShift body) {
        return shiftService.save(body);
    }

    @DeleteMapping("/attendance/shifts/{id}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> deleteShift(@PathVariable Long id) {
        shiftService.delete(id);
        return ResponseEntity.noContent().build();
    }

    public record AssignmentRequest(List<Long> employeeIds, Long shiftId, Long branchId, Boolean useDefaultShift) {}

    /** Assign shift and/or branch to employees. */
    @PutMapping("/attendance/assignments")
    @PreAuthorize(HR_WRITE)
    public Map<String, Object> assign(@RequestBody AssignmentRequest req) {
        int n = shiftService.assign(req.employeeIds(), req.shiftId(), req.branchId(), Boolean.TRUE.equals(req.useDefaultShift()));
        return Map.of("updated", n);
    }

    // --- branches -------------------------------------------------------------------------------

    @GetMapping("/branches")
    @PreAuthorize("isAuthenticated()")
    public List<Branch> branches() {
        return branchService.list();
    }

    @PostMapping("/branches")
    @PreAuthorize(HR_WRITE)
    public Branch saveBranch(@RequestBody Branch body) {
        return branchService.save(body);
    }

    @DeleteMapping("/branches/{id}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> deleteBranch(@PathVariable Long id) {
        branchService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
