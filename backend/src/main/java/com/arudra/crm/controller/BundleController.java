package com.arudra.crm.controller;

import com.arudra.crm.dto.BundleRequests;
import com.arudra.crm.dto.BundleView;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.BundleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Bundle tracking API: stickered bundles of customer material that need work after a sale.
 * BUNDLE_READ scans/views; BUNDLE_MOVE steps a bundle forward (floor staff); BUNDLE_WRITE
 * creates, assigns and edits. Admins/managers may also skip or step back a status.
 */
@RestController
@RequestMapping("/api/bundles")
@CrossOrigin(origins = "*")
public class BundleController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('BUNDLE_READ')";
    private static final String MOVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('BUNDLE_WRITE') or hasAuthority('BUNDLE_MOVE')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('BUNDLE_WRITE')";
    private static final Set<String> OVERRIDE_ROLES = Set.of("ROLE_ADMIN", "ROLE_MANAGER");

    @Autowired private BundleService bundleService;
    @Autowired private CurrentUserService currentUserService;

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<BundleView>> search(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) Long resourceId,
            @RequestParam(defaultValue = "false") boolean overdue,
            @RequestParam(defaultValue = "false") boolean openOnly,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(bundleService.search(status, resourceType, resourceId, overdue, openOnly, q, page, size));
    }

    @GetMapping("/summary")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> summary() {
        return ResponseEntity.ok(bundleService.summary());
    }

    /** The scan lookup — what a sticker's QR/barcode or a typed code opens. */
    @GetMapping("/code/{code}")
    @PreAuthorize(READ)
    public ResponseEntity<BundleView> byCode(@PathVariable String code) {
        return ResponseEntity.ok(bundleService.getByCode(code));
    }

    @GetMapping("/invoice/{invoiceId}")
    @PreAuthorize(READ)
    public ResponseEntity<List<BundleView>> forInvoice(@PathVariable Long invoiceId) {
        return ResponseEntity.ok(bundleService.forInvoice(invoiceId));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<BundleView> get(@PathVariable Long id) {
        return ResponseEntity.ok(bundleService.get(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<List<BundleView>> create(@RequestBody BundleRequests.Create req) {
        return ResponseEntity.ok(bundleService.create(req, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/status")
    @PreAuthorize(MOVE)
    public ResponseEntity<BundleView> move(@PathVariable Long id, @RequestBody BundleRequests.Move req) {
        return ResponseEntity.ok(bundleService.move(id, req, currentUserService.getCurrentUser(), canOverride()));
    }

    @PostMapping("/{id}/hold")
    @PreAuthorize(MOVE)
    public ResponseEntity<BundleView> hold(@PathVariable Long id, @RequestBody BundleRequests.Hold req) {
        return ResponseEntity.ok(bundleService.hold(id, req == null ? null : req.reason, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/release")
    @PreAuthorize(MOVE)
    public ResponseEntity<BundleView> release(@PathVariable Long id) {
        return ResponseEntity.ok(bundleService.release(id, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/assign")
    @PreAuthorize(WRITE)
    public ResponseEntity<BundleView> assign(@PathVariable Long id, @RequestBody BundleRequests.Assign req) {
        return ResponseEntity.ok(bundleService.assign(id, req, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<BundleView> update(@PathVariable Long id, @RequestBody BundleRequests.Update req) {
        return ResponseEntity.ok(bundleService.update(id, req, currentUserService.getCurrentUser()));
    }

    private boolean canOverride() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> OVERRIDE_ROLES.contains(a.getAuthority()));
    }
}
