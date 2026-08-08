package com.arudra.crm.controller;

import com.arudra.crm.dto.CreatePrPayload;
import com.arudra.crm.entity.PurchaseOrder;
import com.arudra.crm.entity.PurchaseRequest;
import com.arudra.crm.service.PurchaseRequestService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Purchase Request API. Mounted at both /api/inventory/purchase-requests (legacy low-stock queue
 * UI) and /api/purchases/requests (purchase module) — same resource, one lifecycle.
 */
@RestController
@RequestMapping({"/api/inventory/purchase-requests", "/api/purchases/requests"})
@CrossOrigin(origins = "*")
public class PurchaseRequestController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('PURCHASE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('PURCHASE_WRITE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('PURCHASE_APPROVE')";

    private final PurchaseRequestService purchaseRequestService;

    public PurchaseRequestController(PurchaseRequestService purchaseRequestService) {
        this.purchaseRequestService = purchaseRequestService;
    }

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<List<PurchaseRequest>> getAll(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(status != null ? purchaseRequestService.getByStatus(status) : purchaseRequestService.getAll());
    }

    @GetMapping("/mine")
    @PreAuthorize(READ)
    public ResponseEntity<List<PurchaseRequest>> getMine() {
        return ResponseEntity.ok(purchaseRequestService.getMine());
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<PurchaseRequest> get(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseRequestService.get(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<PurchaseRequest> create(@RequestBody CreatePrPayload payload) {
        return ResponseEntity.ok(purchaseRequestService.createManual(payload));
    }

    @PostMapping("/scan")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Map<String, Integer>> triggerScan() {
        return ResponseEntity.ok(Map.of("created", purchaseRequestService.runScan()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<PurchaseRequest> approve(@PathVariable Long id,
                                                   @RequestParam(defaultValue = "") String comments) {
        return ResponseEntity.ok(purchaseRequestService.approve(id, comments));
    }

    @PostMapping("/{id}/convert")
    @PreAuthorize(APPROVE)
    public ResponseEntity<List<PurchaseOrder>> convert(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseRequestService.convertToPurchaseOrders(id));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<PurchaseRequest> reject(@PathVariable Long id, @RequestParam(defaultValue = "") String reason) {
        return ResponseEntity.ok(purchaseRequestService.reject(id, reason));
    }
}
