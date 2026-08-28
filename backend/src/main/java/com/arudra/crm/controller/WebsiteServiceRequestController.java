package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.website.ServiceRequestAdminDto.*;
import com.arudra.crm.service.ServiceRequestAdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRM-side inbox for customer service requests. Same {@code /api/website} surface and WEBSITE_READ /
 * WEBSITE_WRITE gating as the catalog CMS. Requests are raised by customers from the portal
 * ({@code POST /api/portal/service-requests}), never here.
 */
@RestController
@RequestMapping("/api/website/service-requests")
public class WebsiteServiceRequestController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_WRITE')";

    private final ServiceRequestAdminService svc;

    public WebsiteServiceRequestController(ServiceRequestAdminService svc) {
        this.svc = svc;
    }

    @GetMapping @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Summary>>> list(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(svc.list(status)));
    }

    @GetMapping("/{id}") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Detail>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(svc.get(id)));
    }

    @PatchMapping("/{id}/status") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Detail>> updateStatus(@PathVariable Long id, @RequestBody StatusUpdate body) {
        return ResponseEntity.ok(ApiResponse.success(svc.updateStatus(id, body.status()),
                "Request status updated."));
    }

    @PostMapping("/{id}/reply") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Detail>> reply(@PathVariable Long id, @RequestBody Reply body) {
        return ResponseEntity.ok(ApiResponse.success(svc.reply(id, body.message()),
                "Reply sent to the customer."));
    }
}
