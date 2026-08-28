package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.service.PortalAccessService;
import com.arudra.crm.service.PortalPolicyService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin management of a customer's portal login. Lets staff grant/revoke a client's access to the
 * self-service portal (where they see their projects, orders, quotations, invoices). Gated like the
 * other customer write endpoints (ROLE_ADMIN or CUSTOMER_WRITE).
 */
@RestController
@RequestMapping("/api/customers/{customerId}/portal-access")
public class PortalAccessController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_WRITE')";

    private final PortalAccessService svc;
    private final PortalPolicyService portalPolicy;

    public PortalAccessController(PortalAccessService svc, PortalPolicyService portalPolicy) {
        this.svc = svc;
        this.portalPolicy = portalPolicy;
    }

    @GetMapping @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> get(@PathVariable Long customerId) {
        return ResponseEntity.ok(ApiResponse.success(svc.getAccess(customerId)));
    }

    @PostMapping @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> grant(
            @PathVariable Long customerId, @RequestBody(required = false) Map<String, String> body) {
        String email = body == null ? null : body.get("email");
        return ResponseEntity.ok(ApiResponse.success(svc.grantAccess(customerId, email),
                "Portal access granted."));
    }

    @DeleteMapping("/{userId}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> revoke(@PathVariable Long customerId, @PathVariable Long userId) {
        svc.revokeAccess(customerId, userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Portal access revoked."));
    }

    @PatchMapping("/{userId}/suspend") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> suspend(
            @PathVariable Long customerId, @PathVariable Long userId, @RequestBody Map<String, Boolean> body) {
        boolean suspended = Boolean.TRUE.equals(body.get("suspended"));
        svc.setSuspended(customerId, userId, suspended);
        return ResponseEntity.ok(ApiResponse.success(null, suspended ? "Portal access suspended." : "Portal access restored."));
    }
}

/** Global customer-portal on/off switch (admin). Separate path — not customer-scoped. */
@RestController
@RequestMapping("/api/website/portal-policy")
class PortalPolicyController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_WRITE')";

    private final PortalPolicyService portalPolicy;

    PortalPolicyController(PortalPolicyService portalPolicy) {
        this.portalPolicy = portalPolicy;
    }

    @GetMapping @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> get() {
        return ResponseEntity.ok(ApiResponse.success(Map.of("enabled", portalPolicy.isEnabled())));
    }

    @PutMapping @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> set(@RequestBody Map<String, Boolean> body) {
        boolean enabled = portalPolicy.setEnabled(Boolean.TRUE.equals(body.get("enabled")));
        return ResponseEntity.ok(ApiResponse.success(Map.of("enabled", enabled),
                enabled ? "Portal turned on." : "Portal turned off for all customers."));
    }
}
