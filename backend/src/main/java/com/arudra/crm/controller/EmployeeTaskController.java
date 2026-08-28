package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.workforce.AssignResourceRequest;
import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.EmployeeTaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Mobile-first Employee Task & Work Execution endpoints. Separate from TaskController
 * (the existing desktop PM endpoints at /api/tasks) so the field-execution workflow can't
 * regress the desktop Kanban/list/calendar views.
 */
@RestController
@RequestMapping("/api/employee-tasks")
@CrossOrigin(origins = "*")
public class EmployeeTaskController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('EMPLOYEE_TASK_READ')";
    private static final String EXECUTE = "hasAuthority('ROLE_ADMIN') or hasAuthority('EMPLOYEE_TASK_EXECUTE')";
    private static final String ISSUE = "hasAuthority('ROLE_ADMIN') or hasAuthority('EMPLOYEE_TASK_ISSUE')";
    private static final String MATERIAL = "hasAuthority('ROLE_ADMIN') or hasAuthority('EMPLOYEE_TASK_MATERIAL')";
    private static final String ASSIGN = "hasAuthority('ROLE_ADMIN') or hasAuthority('TASK_ASSIGN')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('TASK_APPROVE')";

    private final EmployeeTaskService employeeTaskService;
    private final CurrentUserService currentUserService;
    private final com.arudra.crm.service.TaskTimeService taskTimeService;
    private final com.arudra.crm.service.LeadTaskFormService leadTaskFormService;

    public EmployeeTaskController(EmployeeTaskService employeeTaskService, CurrentUserService currentUserService,
                                  com.arudra.crm.service.TaskTimeService taskTimeService,
                                  com.arudra.crm.service.LeadTaskFormService leadTaskFormService) {
        this.employeeTaskService = employeeTaskService;
        this.currentUserService = currentUserService;
        this.taskTimeService = taskTimeService;
        this.leadTaskFormService = leadTaskFormService;
    }

    private User me() {
        User user = currentUserService.getCurrentUser();
        if (user == null) {
            throw new RuntimeException("Unauthenticated");
        }
        return user;
    }

    @GetMapping("/home")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getHome() {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.getHome(me())));
    }

    @GetMapping("/my-tasks")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMyTasks(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.getMyTasks(me(), status, search)));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTaskDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.getTaskDetail(id, me())));
    }

    // ---- Task Pool (self-pick / join / capacity) ----

    /** Eligible, AVAILABLE tasks the employee can pick up — the shared pool. */
    @GetMapping("/pool")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> pool() {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.getAvailablePool(me())));
    }

    /** The employee's active-task capacity (active / max / canPick). */
    @GetMapping("/capacity")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> capacity() {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.getCapacity(me())));
    }

    /** Pick & Start — atomically claim an unassigned, eligible task. */
    @PostMapping("/{id}/pick")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Task>> pick(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.selfAssign(id, me())));
    }

    /** Join an already-owned collaborative task as a participant. */
    @PostMapping("/{id}/join")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Task>> join(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.joinTask(id, me())));
    }

    /**
     * Assign workforce resources to a task. Accepts either the unified shape
     * {@code {resources:[{resourceType,resourceId,role}]}} or the legacy {@code {employeeIds:[...],role}}.
     */
    @PostMapping("/{id}/assignments")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<ApiResponse<Task>> assign(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        String role = (String) payload.get("role");
        Object resources = payload.get("resources");
        if (resources instanceof List<?> rawResources && !rawResources.isEmpty()) {
            List<AssignResourceRequest> requests = new java.util.ArrayList<>();
            for (Object o : rawResources) {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = (Map<String, Object>) o;
                Long rid = m.get("resourceId") != null ? ((Number) m.get("resourceId")).longValue() : null;
                String r = m.get("role") != null ? (String) m.get("role") : role;
                requests.add(new AssignResourceRequest((String) m.get("resourceType"), rid, r));
            }
            return ResponseEntity.ok(ApiResponse.success(employeeTaskService.assignResources(id, requests, me())));
        }
        @SuppressWarnings("unchecked")
        List<Integer> rawIds = (List<Integer>) payload.get("employeeIds");
        List<Long> employeeIds = rawIds.stream().map(Integer::longValue).toList();
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.assignEmployees(id, employeeIds, role, me())));
    }

    /** Legacy: remove an employee assignment by employee id. */
    @DeleteMapping("/{id}/assignments/{employeeId}")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<Void> removeAssignment(@PathVariable Long id, @PathVariable Long employeeId) {
        employeeTaskService.removeAssignment(id, employeeId);
        return ResponseEntity.ok().build();
    }

    /** Unified: remove any resource's assignment. */
    @DeleteMapping("/{id}/assignments/{resourceType}/{resourceId}")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<Void> removeResourceAssignment(@PathVariable Long id,
            @PathVariable String resourceType, @PathVariable Long resourceId) {
        employeeTaskService.removeResourceAssignment(id, resourceType, resourceId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/accept")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Task>> accept(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.accept(id, me())));
    }

    @PostMapping("/{id}/start")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Task>> start(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.start(id, me())));
    }

    @PostMapping("/{id}/pause")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Task>> pause(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        String remarks = body == null ? null : body.get("remarks");
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.pause(id, me(), remarks)));
    }

    @PostMapping("/{id}/resume")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Task>> resume(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.resume(id, me())));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Task>> complete(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        String remarks = body == null ? null : body.get("remarks");
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.complete(id, me(), remarks)));
    }

    /**
     * Submit a lead-workflow task's structured data form (Contact/Requirement/Qualify/Site-Visit…).
     * Captures the submission, applies it to the lead, then completes the task.
     * Payload: {outcome, notes, nextFollowUpDate, media:[...], data:{...}}.
     */
    @PostMapping("/{id}/lead-form")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitLeadForm(
            @PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(leadTaskFormService.submit(id, me(), body)));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<Task>> approve(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.approveCompletion(id, me())));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<Task>> reject(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.rejectCompletion(id, me(), body.get("remarks"))));
    }

    @SuppressWarnings("unchecked")
    @PostMapping("/{id}/progress")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> addProgress(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Integer progressPercent = body.get("progressPercent") == null ? null : ((Number) body.get("progressPercent")).intValue();
        Integer timeSpentMinutes = body.get("timeSpentMinutes") == null ? null : ((Number) body.get("timeSpentMinutes")).intValue();
        String remarks = (String) body.get("remarks");
        List<Map<String, Object>> media = (List<Map<String, Object>>) body.get("media");
        return ResponseEntity.ok(ApiResponse.success(
                employeeTaskService.addProgress(id, me(), progressPercent, remarks, timeSpentMinutes, media)));
    }

    @PostMapping("/checklist-items/{itemId}/toggle")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> toggleChecklistItem(@PathVariable Long itemId) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.toggleChecklistItem(itemId, me())));
    }

    @PostMapping("/{id}/checklist")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> addChecklistItem(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String checklistName = body.getOrDefault("checklistName", "Checklist");
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.addChecklistItem(id, checklistName, body.get("content"))));
    }

    @PostMapping("/{id}/issues")
    @PreAuthorize(ISSUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> reportIssue(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success(
                employeeTaskService.reportIssue(id, me(), body.get("issueType"), body.get("description"))));
    }

    @GetMapping("/{id}/issues")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getIssues(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.getIssues(id)));
    }

    @PostMapping("/{id}/material-usage")
    @PreAuthorize(MATERIAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> logMaterialUsage(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long productId = ((Number) body.get("productId")).longValue();
        BigDecimal quantity = new BigDecimal(body.get("quantity").toString());
        String remarks = (String) body.get("remarks");
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.logMaterialUsage(id, me(), productId, quantity, remarks)));
    }

    @PostMapping("/{id}/checkin")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkIn(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        Double lat = body != null && body.get("latitude") != null ? ((Number) body.get("latitude")).doubleValue() : null;
        Double lng = body != null && body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null;
        String label = body != null ? (String) body.get("locationLabel") : null;
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.checkIn(id, me(), lat, lng, label)));
    }

    @PostMapping("/{id}/checkout")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkOut(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        Double lat = body != null && body.get("latitude") != null ? ((Number) body.get("latitude")).doubleValue() : null;
        Double lng = body != null && body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null;
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.checkOut(id, me(), lat, lng)));
    }

    @GetMapping("/reports/summary")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getReportsSummary() {
        return ResponseEntity.ok(ApiResponse.success(employeeTaskService.getReportsSummary()));
    }

    // ---- Task time tracking → payroll approval (Increment 5) ----

    @PostMapping("/{id}/time/start")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> timeStart(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(taskTimeService.startWork(id, me())));
    }

    @PostMapping("/{id}/time/pause")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> timePause(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(taskTimeService.pauseWork(id, me())));
    }

    @PostMapping("/{id}/time/resume")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> timeResume(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(taskTimeService.resumeWork(id, me())));
    }

    @PostMapping("/{id}/time/stop")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> timeStop(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(taskTimeService.stopWork(id, me())));
    }

    /** The current employee's own timesheet for a date range. */
    @GetMapping("/time/timesheet")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> timesheet(
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(taskTimeService.getTimesheet(me(), from, to)));
    }

    /** Submit all finished draft time in a range for approval. */
    @PostMapping("/time/submit")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitTime(
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        int submitted = taskTimeService.submitRange(me(), from, to);
        return ResponseEntity.ok(ApiResponse.success(Map.of("submitted", submitted)));
    }

    /** Supervisor/admin: time awaiting approval. */
    @GetMapping("/time/pending")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> pendingTime() {
        return ResponseEntity.ok(ApiResponse.success(taskTimeService.pendingApprovals()));
    }

    @PostMapping("/time/{logId}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> approveTime(@PathVariable Long logId) {
        return ResponseEntity.ok(ApiResponse.success(taskTimeService.approve(logId, me())));
    }

    @PostMapping("/time/{logId}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> rejectTime(@PathVariable Long logId,
            @RequestBody(required = false) Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success(taskTimeService.reject(logId, me(), body == null ? null : body.get("remarks"))));
    }

    /** HR/payroll read: approved task hours for an employee over a period (APPROVED records only). */
    @GetMapping("/time/approved-hours")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> approvedHours(@RequestParam Long employeeId,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(taskTimeService.approvedHours(employeeId, from, to)));
    }
}
