package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.assignment.RecommendRequest;
import com.arudra.crm.entity.AssignmentSettings;
import com.arudra.crm.entity.User;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.SmartAssignmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Smart Employee Auto Assignment API. The recommendation engine, one-click assign / replace,
 * manager settings, assignment history and the workload dashboard widgets.
 */
@RestController
@RequestMapping("/api/assignments")
@CrossOrigin(origins = "*")
public class SmartAssignmentController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('ASSIGNMENT_READ') or hasAuthority('TASK_ASSIGN')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('ASSIGNMENT_WRITE') or hasAuthority('TASK_ASSIGN')";

    private final SmartAssignmentService service;
    private final CurrentUserService currentUserService;

    public SmartAssignmentController(SmartAssignmentService service, CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    private User me() {
        User user = currentUserService.getCurrentUser();
        if (user == null) throw new RuntimeException("Unauthenticated");
        return user;
    }

    // ------------------------------------------------------ Recommendation

    @PostMapping("/recommend")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> recommend(@RequestBody RecommendRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.recommend(request)));
    }

    // ------------------------------------------------------ Assign / replace

    @PostMapping("/assign")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> assign(@RequestBody Map<String, Object> payload) {
        Long taskId = toLong(payload.get("taskId"));
        String method = payload.get("method") == null ? "MANUAL" : String.valueOf(payload.get("method"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> selections = (List<Map<String, Object>>) payload.get("selections");
        if (taskId == null || selections == null || selections.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("taskId and selections are required"));
        }
        return ResponseEntity.ok(ApiResponse.success(service.assign(taskId, selections, method, me())));
    }

    @GetMapping("/replace/suggest")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> suggestReplacement(
            @RequestParam Long taskId,
            @RequestParam(defaultValue = "EMPLOYEE") String resourceType,
            @RequestParam Long resourceId,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(ApiResponse.success(service.suggestReplacement(taskId, resourceType, resourceId, reason)));
    }

    @PostMapping("/replace")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> replace(@RequestBody Map<String, Object> payload) {
        Long taskId = toLong(payload.get("taskId"));
        String oldType = payload.get("oldResourceType") == null ? "EMPLOYEE" : String.valueOf(payload.get("oldResourceType"));
        Long oldId = toLong(payload.get("oldResourceId"));
        String reason = payload.get("reason") == null ? null : String.valueOf(payload.get("reason"));
        @SuppressWarnings("unchecked")
        Map<String, Object> replacement = (Map<String, Object>) payload.get("replacement");
        if (taskId == null || oldId == null || replacement == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("taskId, oldResourceId and replacement are required"));
        }
        return ResponseEntity.ok(ApiResponse.success(service.replace(taskId, oldType, oldId, replacement, reason, me())));
    }

    // ------------------------------------------------------ Settings

    @GetMapping("/settings")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<AssignmentSettings>> getSettings() {
        return ResponseEntity.ok(ApiResponse.success(service.getSettings()));
    }

    @PutMapping("/settings")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<AssignmentSettings>> updateSettings(@RequestBody AssignmentSettings settings) {
        return ResponseEntity.ok(ApiResponse.success(service.updateSettings(settings), "Settings updated"));
    }

    // ------------------------------------------------------ History & dashboard

    @GetMapping("/history")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> history(
            @RequestParam(required = false) Long taskId) {
        return ResponseEntity.ok(ApiResponse.success(service.getHistory(taskId)));
    }

    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(service.dashboard()));
    }

    // ------------------------------------------------------ Merged Tasks & Employees board

    /** All tasks pre-bucketed (UNASSIGNED / ASSIGNED / IN_PROGRESS / NEEDS_APPROVAL / COMPLETED) for the Tasks tab. */
    @GetMapping("/task-board")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> taskBoard() {
        return ResponseEntity.ok(ApiResponse.success(service.taskBoard()));
    }

    /** Per-employee roster (tasks now / completed 24h / working now) for the Employees tab. */
    @GetMapping("/roster")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> roster() {
        return ResponseEntity.ok(ApiResponse.success(service.roster()));
    }

    private Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try { return Long.parseLong(o.toString()); } catch (NumberFormatException e) { return null; }
    }
}
