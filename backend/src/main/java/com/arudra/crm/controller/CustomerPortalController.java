package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.entity.User;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.CustomerPortalService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Customer self-service portal. Every endpoint is scoped to the customer id(s) linked to the
 * signed-in user via {@link com.arudra.crm.security.CustomerAccessService}; none takes a customer
 * id from the client, and endpoints that take a resource id assert ownership. A customer therefore
 * can never read another customer's data by changing an id in the URL.
 */
@RestController
@RequestMapping("/api/portal")
@CrossOrigin(origins = "*")
public class CustomerPortalController {

    private static final String PORTAL = "hasAuthority('ROLE_ADMIN') or hasAuthority('ROLE_CUSTOMER')";

    private final CustomerPortalService portal;
    private final CurrentUserService currentUserService;
    private final com.arudra.crm.service.PortalPolicyService portalPolicy;

    public CustomerPortalController(CustomerPortalService portal, CurrentUserService currentUserService,
                                    com.arudra.crm.service.PortalPolicyService portalPolicy) {
        this.portal = portal;
        this.currentUserService = currentUserService;
        this.portalPolicy = portalPolicy;
    }

    private User me() {
        portalPolicy.assertEnabled(); // global portal on/off gate (503 when disabled)
        User user = currentUserService.getCurrentUser();
        if (user == null) throw new IllegalStateException("Unauthenticated");
        return user;
    }

    @GetMapping("/dashboard")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(portal.dashboard(me())));
    }

    @GetMapping("/profile")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> profile() {
        return ResponseEntity.ok(ApiResponse.success(portal.profile(me())));
    }

    @PutMapping("/profile")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateProfile(@RequestBody Map<String, String> updates) {
        return ResponseEntity.ok(ApiResponse.success(portal.updateProfile(me(), updates), "Profile updated."));
    }

    @GetMapping("/projects")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> projects() {
        return ResponseEntity.ok(ApiResponse.success(portal.projects(me())));
    }

    @GetMapping("/projects/{id}")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> project(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(portal.project(me(), id)));
    }

    @GetMapping("/quotations")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> quotations() {
        return ResponseEntity.ok(ApiResponse.success(portal.quotations(me())));
    }

    @GetMapping("/invoices")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> invoices() {
        return ResponseEntity.ok(ApiResponse.success(portal.invoices(me())));
    }

    @GetMapping("/payments")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> payments() {
        return ResponseEntity.ok(ApiResponse.success(portal.payments(me())));
    }

    @GetMapping("/documents")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> documents() {
        return ResponseEntity.ok(ApiResponse.success(portal.documents(me())));
    }

    @GetMapping("/orders")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> orders() {
        return ResponseEntity.ok(ApiResponse.success(portal.orders(me())));
    }

    @GetMapping("/service-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> serviceRequests() {
        return ResponseEntity.ok(ApiResponse.success(portal.serviceRequests(me())));
    }

    @PostMapping("/service-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> createServiceRequest(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(portal.createServiceRequest(me(), body),
                "Service request submitted."));
    }

    @GetMapping("/services")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> services() {
        return ResponseEntity.ok(ApiResponse.success(portal.services(me())));
    }

    @PostMapping("/services/{serviceId}/review")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Map<String, Object>>> reviewService(
            @PathVariable Long serviceId, @RequestBody Map<String, Object> body) {
        Integer rating = body.get("rating") == null ? null : Integer.valueOf(body.get("rating").toString());
        String comment = body.get("comment") == null ? null : body.get("comment").toString();
        return ResponseEntity.ok(ApiResponse.success(portal.reviewService(me(), serviceId, rating, comment),
                "Thanks for your review!"));
    }

    @GetMapping("/notifications")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> notifications() {
        return ResponseEntity.ok(ApiResponse.success(portal.notifications(me())));
    }

    @PostMapping("/notifications/{id}/read")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ApiResponse<Void>> markRead(@PathVariable Long id) {
        portal.markNotificationRead(me(), id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /** Portal-disabled (503) surfaces as a clean message rather than the app's generic 500. */
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handlePortalDisabled(
            org.springframework.web.server.ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(ApiResponse.error(ex.getReason()));
    }
}
