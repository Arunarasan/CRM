package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ProjectWorkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Category → Product work tracking behind a project's "Project Execution" and "Installation" tasks.
 * Used by the office (project page) and the field team (employee task screens) alike.
 */
@RestController
@RequestMapping("/api/project-work")
@RequiredArgsConstructor
public class ProjectWorkController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('PROJECT_READ') or hasAuthority('EMPLOYEE_TASK_READ')";
    private static final String WORK = "hasAuthority('ROLE_ADMIN') or hasAuthority('PROJECT_WRITE') or hasAuthority('EMPLOYEE_TASK_EXECUTE')";
    private static final String MANAGE = "hasAuthority('ROLE_ADMIN') or hasAuthority('PROJECT_WRITE')";

    private final ProjectWorkService workService;
    private final CurrentUserService currentUserService;

    private <T> ResponseEntity<ApiResponse<T>> ok(T body) {
        return ResponseEntity.ok(ApiResponse.success(body));
    }

    @GetMapping("/projects/{projectId}")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> board(@PathVariable Long projectId) {
        return ok(workService.getBoard(projectId));
    }

    /** Create both tasks + the product lines from the approved quote (safe to repeat). */
    @PostMapping("/projects/{projectId}/setup")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> setup(@PathVariable Long projectId) {
        return ok(workService.setup(projectId));
    }

    @PostMapping("/projects/{projectId}/sync-quote")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> syncQuote(@PathVariable Long projectId) {
        workService.syncFromQuote(projectId);
        return ok(workService.getBoard(projectId));
    }

    @PostMapping("/projects/{projectId}/lines")
    @PreAuthorize(WORK)
    public ResponseEntity<ApiResponse<Map<String, Object>>> addLine(@PathVariable Long projectId,
                                                                    @RequestBody Map<String, Object> body) {
        return ok(workService.addLine(projectId, body));
    }

    @PutMapping("/lines/{lineId}")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateLine(@PathVariable Long lineId,
                                                                       @RequestBody Map<String, Object> body) {
        return ok(workService.updateLine(lineId, body));
    }

    @DeleteMapping("/lines/{lineId}")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> removeLine(@PathVariable Long lineId) {
        return ok(workService.removeLine(lineId));
    }

    /** Which steps this product needs: {@code {"steps": ["MATERIAL","STITCHING","DELIVERY"]}}. */
    @PutMapping("/lines/{lineId}/steps")
    @PreAuthorize(WORK)
    public ResponseEntity<ApiResponse<Map<String, Object>>> setLineSteps(@PathVariable Long lineId,
                                                                         @RequestBody Map<String, List<String>> body) {
        return ok(workService.setLineSteps(lineId, body.get("steps")));
    }

    @PutMapping("/steps/{stepId}")
    @PreAuthorize(WORK)
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateStep(@PathVariable Long stepId,
                                                                       @RequestBody Map<String, Object> body) {
        return ok(workService.updateStep(stepId, body, currentUserService.getCurrentUser()));
    }

    @PostMapping("/projects/{projectId}/install-categories")
    @PreAuthorize(WORK)
    public ResponseEntity<ApiResponse<Map<String, Object>>> addInstallCategory(@PathVariable Long projectId,
                                                                               @RequestBody Map<String, String> body) {
        return ok(workService.addInstallCategory(projectId, body.get("category")));
    }

    @PutMapping("/install-categories/{categoryId}/percent")
    @PreAuthorize(WORK)
    public ResponseEntity<ApiResponse<Map<String, Object>>> setInstallPercent(@PathVariable Long categoryId,
                                                                              @RequestBody Map<String, Integer> body) {
        return ok(workService.setInstallPercent(categoryId, body.get("percent"), currentUserService.getCurrentUser()));
    }

    @PostMapping("/install-categories/{categoryId}/steps")
    @PreAuthorize(WORK)
    public ResponseEntity<ApiResponse<Map<String, Object>>> addInstallStep(@PathVariable Long categoryId,
                                                                           @RequestBody Map<String, String> body) {
        return ok(workService.addInstallStep(categoryId, body.get("content")));
    }

    @PutMapping("/install-steps/{stepId}/toggle")
    @PreAuthorize(WORK)
    public ResponseEntity<ApiResponse<Map<String, Object>>> toggleInstallStep(@PathVariable Long stepId) {
        return ok(workService.toggleInstallStep(stepId, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/install-steps/{stepId}")
    @PreAuthorize(WORK)
    public ResponseEntity<ApiResponse<Map<String, Object>>> removeInstallStep(@PathVariable Long stepId) {
        return ok(workService.removeInstallStep(stepId));
    }

    @GetMapping("/tasks/{taskId}/daily-logs")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> dailyLogs(@PathVariable Long taskId) {
        return ok(workService.dailyLogs(taskId));
    }

    @PostMapping("/tasks/{taskId}/daily-logs")
    @PreAuthorize(WORK)
    public ResponseEntity<ApiResponse<Map<String, Object>>> addDailyLog(@PathVariable Long taskId,
                                                                        @RequestBody Map<String, Object> body) {
        return ok(workService.addDailyLog(taskId, body, currentUserService.getCurrentUser()));
    }

    @GetMapping("/projects/{projectId}/daily-logs")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> projectDailyLogs(@PathVariable Long projectId) {
        return ok(workService.projectDailyLogs(projectId));
    }

    @GetMapping("/projects/{projectId}/events")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> events(@PathVariable Long projectId) {
        return ok(workService.events(projectId));
    }
}
