package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.TaskCancelRequestService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Admin side of "cancel this task's lead / project" requests raised by employees. */
@RestController
@RequestMapping("/api/task-cancel-requests")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class TaskCancelRequestController {

    private final TaskCancelRequestService service;
    private final CurrentUserService currentUserService;

    public TaskCancelRequestController(TaskCancelRequestService service, CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> pending() {
        return ResponseEntity.ok(ApiResponse.success(service.pending()));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approve(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(service.approve(id, currentUserService.getCurrentUser())));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reject(@PathVariable Long id,
                                                                   @RequestBody(required = false) Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success(
                service.reject(id, currentUserService.getCurrentUser(), body != null ? body.get("note") : null)));
    }
}
