package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ProjectServiceWarrantyService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Post-completion Service & Warranty API for the Project screen. Reuses PROJECT_READ / PROJECT_WRITE
 * gating; delegates to {@link ProjectServiceWarrantyService}. Service works are the same
 * {@code service_requests} the customer portal raises, so they still surface on the task board.
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ServiceWarrantyController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('PROJECT_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('PROJECT_WRITE')";

    private final ProjectServiceWarrantyService service;
    private final CurrentUserService currentUserService;

    public ServiceWarrantyController(ProjectServiceWarrantyService service, CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    /** Warranty cover + all service works for a project. */
    @GetMapping("/projects/{id}/service-warranty")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> overview(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(service.getOverview(id)));
    }

    /** Activate (or re-save) warranty cover on a completed project. */
    @PostMapping("/projects/{id}/warranty")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> activateWarranty(
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(service.activateWarranty(id, body), "Warranty saved."));
    }

    /** Log a new service work against a completed project (spawns a task on the board). */
    @PostMapping("/projects/{id}/service-works")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> createServiceWork(
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(service.createServiceWork(id, body), "Service work logged."));
    }

    @PutMapping("/service-works/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateServiceWork(
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(service.updateServiceWork(id, body), "Service work updated."));
    }

    /** Raise a Billing invoice for a PAID service work. */
    @PostMapping("/service-works/{id}/invoice")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> raiseInvoice(
            @PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(
                service.raiseInvoice(id, body == null ? Map.of() : body, currentUserService.getCurrentUser()),
                "Invoice raised."));
    }
}
