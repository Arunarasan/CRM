package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.website.OrderAdminDto.*;
import com.arudra.crm.service.WebsiteOrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRM-side management of website shop orders. Same {@code /api/website} surface and WEBSITE_READ /
 * WEBSITE_WRITE gating as the catalog CMS ({@link WebsiteAdminController}). Read the queue, open an
 * order, and drive its fulfilment + payment status. Orders are created by the public guest checkout
 * ({@code POST /api/public/orders}), never here.
 */
@RestController
@RequestMapping("/api/website/orders")
public class WebsiteOrderController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_WRITE')";

    private final WebsiteOrderService svc;

    public WebsiteOrderController(WebsiteOrderService svc) {
        this.svc = svc;
    }

    @GetMapping @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<OrderSummary>>> list(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(svc.list(status)));
    }

    @GetMapping("/{id}") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<OrderDetail>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(svc.get(id)));
    }

    @PatchMapping("/{id}/status") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<OrderDetail>> updateStatus(
            @PathVariable Long id, @RequestBody StatusUpdate body) {
        return ResponseEntity.ok(ApiResponse.success(svc.updateStatus(id, body.status()),
                "Order status updated."));
    }

    @PatchMapping("/{id}/payment") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<OrderDetail>> updatePayment(
            @PathVariable Long id, @RequestBody PaymentUpdate body) {
        return ResponseEntity.ok(ApiResponse.success(
                svc.updatePayment(id, body.paymentStatus(), body.paymentRef()),
                "Payment status updated."));
    }
}
