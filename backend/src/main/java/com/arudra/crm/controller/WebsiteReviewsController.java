package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.service.ServiceReviewAdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin moderation of customer service reviews. Same {@code /api/website} surface + WEBSITE gating as
 * the rest of the CMS. Reviews are written by customers from the portal; here staff hide or delete them.
 */
@RestController
@RequestMapping("/api/website/service-reviews")
public class WebsiteReviewsController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_WRITE')";

    private final ServiceReviewAdminService svc;

    public WebsiteReviewsController(ServiceReviewAdminService svc) {
        this.svc = svc;
    }

    @GetMapping @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> list() {
        return ResponseEntity.ok(ApiResponse.success(svc.list()));
    }

    @PatchMapping("/{id}/status") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> setStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        svc.setStatus(id, body.get("status"));
        return ResponseEntity.ok(ApiResponse.success(null, "Review updated."));
    }

    @DeleteMapping("/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        svc.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Review deleted."));
    }
}
