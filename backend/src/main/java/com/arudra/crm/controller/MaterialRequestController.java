package com.arudra.crm.controller;

import com.arudra.crm.entity.MaterialRequest;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.MaterialRequestService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory/material-requests")
@CrossOrigin(origins = "*")
public class MaterialRequestController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('MATERIAL_REQUEST_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('MATERIAL_REQUEST_WRITE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('MATERIAL_REQUEST_APPROVE')";

    private final MaterialRequestService materialRequestService;
    private final CurrentUserService currentUserService;

    public MaterialRequestController(MaterialRequestService materialRequestService, CurrentUserService currentUserService) {
        this.materialRequestService = materialRequestService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<List<MaterialRequest>> getAll(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(status != null ? materialRequestService.getByStatus(status) : materialRequestService.getAll());
    }

    @GetMapping("/mine")
    @PreAuthorize(READ)
    public ResponseEntity<List<MaterialRequest>> getMine() {
        return ResponseEntity.ok(materialRequestService.getMine(currentUserService.getCurrentUser().getId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<MaterialRequest> get(@PathVariable Long id) {
        return ResponseEntity.ok(materialRequestService.get(id));
    }

    @SuppressWarnings("unchecked")
    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<MaterialRequest> create(@RequestBody Map<String, Object> request) {
        Long taskId = request.get("taskId") != null ? Long.valueOf(String.valueOf(request.get("taskId"))) : null;
        Long projectId = request.get("projectId") != null ? Long.valueOf(String.valueOf(request.get("projectId"))) : null;
        Long warehouseId = request.get("warehouseId") != null ? Long.valueOf(String.valueOf(request.get("warehouseId"))) : null;
        List<Map<String, Object>> items = (List<Map<String, Object>>) request.get("items");
        String remarks = (String) request.get("remarks");
        return ResponseEntity.ok(materialRequestService.create(
                taskId, projectId, warehouseId, items, remarks, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<MaterialRequest> approve(@PathVariable Long id) {
        return ResponseEntity.ok(materialRequestService.approve(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<MaterialRequest> reject(@PathVariable Long id, @RequestParam(defaultValue = "") String reason) {
        return ResponseEntity.ok(materialRequestService.reject(id, currentUserService.getCurrentUser(), reason));
    }

    @PostMapping("/{id}/issue")
    @PreAuthorize(WRITE)
    public ResponseEntity<MaterialRequest> issue(@PathVariable Long id) {
        return ResponseEntity.ok(materialRequestService.issue(id));
    }
}
