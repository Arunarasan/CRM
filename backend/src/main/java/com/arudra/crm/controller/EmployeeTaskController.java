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

    public EmployeeTaskController(EmployeeTaskService employeeTaskService, CurrentUserService currentUserService) {
        this.employeeTaskService = employeeTaskService;
        this.currentUserService = currentUserService;
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
}
