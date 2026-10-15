package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.entity.User;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ProjectConversionRequestService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Field employee "Customer Agreed" → admin approval → project. See {@link ProjectConversionRequestService}.
 */
@RestController
@RequestMapping("/api/project-requests")
public class ProjectConversionRequestController {

    private static final String EXECUTE = "hasAuthority('ROLE_ADMIN') or hasAuthority('EMPLOYEE_TASK_EXECUTE')";
    private static final String DECIDE = "hasAuthority('ROLE_ADMIN') or hasAuthority('ROLE_PROJECT_MANAGER')";

    private final ProjectConversionRequestService service;
    private final CurrentUserService currentUserService;

    public ProjectConversionRequestController(ProjectConversionRequestService service, CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    /** Send the customer-agreed quote (+ optional advance) for approval: {advanceAmount, paymentMethod, referenceNumber, proofUrl, note}. */
    @PostMapping("/lead/{leadId}")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> request(@PathVariable Long leadId,
                                                                    @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> b = body != null ? body : Map.of();
        return ResponseEntity.ok(ApiResponse.success(service.request(leadId, currentUserService.getCurrentUser(),
                money(b.get("advanceAmount")), str(b.get("paymentMethod")), str(b.get("referenceNumber")),
                str(b.get("proofUrl")), str(b.get("note")))));
    }

    /** The latest request on a lead (empty when there is none). */
    @GetMapping("/lead/{leadId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> forLead(@PathVariable Long leadId) {
        return ResponseEntity.ok(ApiResponse.success(service.latestForLead(leadId)));
    }

    @GetMapping("/pending")
    @PreAuthorize(DECIDE)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> pending() {
        return ResponseEntity.ok(ApiResponse.success(service.pending()));
    }

    /** Approve → project created; {advanceAmount, paymentMethod} optionally correct the advance after checking it. */
    @PostMapping("/{id}/approve")
    @PreAuthorize(DECIDE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> approve(@PathVariable Long id,
                                                                    @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> b = body != null ? body : Map.of();
        User me = currentUserService.getCurrentUser();
        return ResponseEntity.ok(ApiResponse.success(service.approve(id, me, money(b.get("advanceAmount")), str(b.get("paymentMethod")))));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(DECIDE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> reject(@PathVariable Long id,
                                                                   @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(service.reject(id, currentUserService.getCurrentUser(),
                body != null ? str(body.get("reason")) : null)));
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static BigDecimal money(Object o) {
        if (o == null || String.valueOf(o).isBlank()) return null;
        try { return new BigDecimal(String.valueOf(o).replace(",", "").trim()); }
        catch (NumberFormatException e) { throw new IllegalArgumentException("Enter a valid amount."); }
    }
}
