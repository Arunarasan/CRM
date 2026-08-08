package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.entity.ProjectChangeRequest;
import com.arudra.crm.entity.ProjectChangeRequestPhase;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ProjectChangeRequestService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/change-requests")
@CrossOrigin(origins = "*")
public class ProjectChangeRequestController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('CHANGE_REQUEST_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('CHANGE_REQUEST_WRITE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('CHANGE_REQUEST_APPROVE')";

    private final ProjectChangeRequestService changeRequestService;
    private final CurrentUserService currentUserService;

    public ProjectChangeRequestController(ProjectChangeRequestService changeRequestService, CurrentUserService currentUserService) {
        this.changeRequestService = changeRequestService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Page<ProjectChangeRequest>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(changeRequestService.getByStatus(status, page, size)));
    }

    @GetMapping("/project/{projectId}")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ProjectChangeRequest>>> byProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.success(changeRequestService.getByProject(projectId)));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<ProjectChangeRequest>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(changeRequestService.getById(id)));
    }

    @PostMapping("/project/{projectId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectChangeRequest>> create(
            @PathVariable Long projectId, @RequestBody ProjectChangeRequest details) {
        return ResponseEntity.ok(ApiResponse.success(
                changeRequestService.create(projectId, details, currentUserService.getCurrentUser())));
    }

    @GetMapping("/{id}/phases")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ProjectChangeRequestPhase>>> getPhaseActions(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(changeRequestService.getPhaseActions(id)));
    }

    @PostMapping("/{id}/phases")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectChangeRequestPhase>> addPhaseAction(
            @PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Long projectPhaseId = Long.valueOf(payload.get("projectPhaseId").toString());
        String action = payload.get("action").toString();
        return ResponseEntity.ok(ApiResponse.success(changeRequestService.addPhaseAction(id, projectPhaseId, action)));
    }

    @DeleteMapping("/phases/{lineId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> removePhaseAction(@PathVariable Long lineId) {
        changeRequestService.removePhaseAction(lineId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<ProjectChangeRequest>> approve(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                changeRequestService.approve(id, currentUserService.getCurrentUser())));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<ProjectChangeRequest>> reject(
            @PathVariable Long id, @RequestBody(required = false) Map<String, String> payload) {
        String reason = payload != null ? payload.get("reason") : null;
        return ResponseEntity.ok(ApiResponse.success(
                changeRequestService.reject(id, reason, currentUserService.getCurrentUser())));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectChangeRequest>> complete(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                changeRequestService.complete(id, currentUserService.getCurrentUser())));
    }
}
