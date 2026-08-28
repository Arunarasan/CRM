package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.entity.Task;
import com.arudra.crm.service.WorkflowConsoleService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Admin/supervisor exception console API (spec §44). Read the task landscape and act on exceptions —
 * extend, reprioritise, return to pool, cancel. Routine work is self-service via the employee APIs.
 */
@RestController
@RequestMapping("/api/workflow/console")
@CrossOrigin(origins = "*")
public class WorkflowConsoleController {

    private static final String ADMIN = "hasAuthority('ROLE_ADMIN') or hasAuthority('TASK_APPROVE')";

    private final WorkflowConsoleService consoleService;

    public WorkflowConsoleController(WorkflowConsoleService consoleService) {
        this.consoleService = consoleService;
    }

    @GetMapping("/overview")
    @PreAuthorize(ADMIN)
    public ResponseEntity<ApiResponse<Map<String, Object>>> overview() {
        return ResponseEntity.ok(ApiResponse.success(consoleService.overview()));
    }

    @PostMapping("/tasks/{id}/extend")
    @PreAuthorize(ADMIN)
    public ResponseEntity<ApiResponse<Task>> extend(@PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueDate) {
        return ResponseEntity.ok(ApiResponse.success(consoleService.extendDueDate(id, dueDate)));
    }

    @PostMapping("/tasks/{id}/priority")
    @PreAuthorize(ADMIN)
    public ResponseEntity<ApiResponse<Task>> priority(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success(consoleService.changePriority(id, body.get("priority"))));
    }

    @PostMapping("/tasks/{id}/return-to-pool")
    @PreAuthorize(ADMIN)
    public ResponseEntity<ApiResponse<Task>> returnToPool(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(consoleService.returnToPool(id)));
    }

    @PostMapping("/tasks/{id}/cancel")
    @PreAuthorize(ADMIN)
    public ResponseEntity<ApiResponse<Task>> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(consoleService.cancelTask(id)));
    }
}
