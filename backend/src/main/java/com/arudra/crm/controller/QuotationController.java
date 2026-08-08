package com.arudra.crm.controller;

import com.arudra.crm.entity.Project;
import com.arudra.crm.entity.Quotation;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.QuotationService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/quotations")
@CrossOrigin(origins = "*")
public class QuotationController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('QUOTATION_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('QUOTATION_WRITE')";
    private static final String DELETE = "hasAuthority('ROLE_ADMIN') or hasAuthority('QUOTATION_DELETE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('QUOTATION_APPROVE')";

    private final QuotationService quotationService;
    private final CurrentUserService currentUserService;

    public QuotationController(QuotationService quotationService, CurrentUserService currentUserService) {
        this.quotationService = quotationService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<Quotation>> getAllQuotations(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(quotationService.getQuotations(search, page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Quotation> getQuotationById(@PathVariable Long id) {
        return ResponseEntity.ok(quotationService.getQuotationForView(id));
    }

    @GetMapping("/{id}/revisions")
    @PreAuthorize(READ)
    public ResponseEntity<List<Quotation>> getRevisionFamily(@PathVariable Long id) {
        return ResponseEntity.ok(quotationService.getRevisionFamily(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<Quotation> createQuotation(@RequestBody Quotation quotation) {
        return ResponseEntity.ok(quotationService.createQuotation(quotation, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Quotation> updateQuotation(@PathVariable Long id, @RequestBody Quotation quotation) {
        return ResponseEntity.ok(quotationService.updateQuotation(id, quotation, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/sync-from-boq")
    @PreAuthorize(WRITE)
    public ResponseEntity<Quotation> syncFromBoq(@PathVariable Long id) {
        return ResponseEntity.ok(quotationService.syncFromBoq(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/duplicate")
    @PreAuthorize(WRITE)
    public ResponseEntity<Quotation> duplicateQuotation(@PathVariable Long id) {
        return ResponseEntity.ok(quotationService.duplicateQuotation(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/revise")
    @PreAuthorize(WRITE)
    public ResponseEntity<Quotation> createRevision(@PathVariable Long id) {
        return ResponseEntity.ok(quotationService.createRevision(id, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/approval")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Quotation> updateApprovalStatus(@PathVariable Long id, @RequestParam String status) {
        return ResponseEntity.ok(quotationService.updateApprovalStatus(id, status, currentUserService.getCurrentUser()));
    }

    /** Customer approves a subset of quotation items — drives partial execution. */
    @PostMapping("/{id}/approve-items")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Quotation> approveItems(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        List<Long> itemIds = extractIds(payload);
        return ResponseEntity.ok(quotationService.approveItems(id, itemIds, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/reject-items")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Quotation> rejectItems(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        List<Long> itemIds = extractIds(payload);
        return ResponseEntity.ok(quotationService.rejectItems(id, itemIds, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/reserve-inventory")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> reserveInventory(@PathVariable Long id) {
        quotationService.reserveInventory(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/release-inventory")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> releaseInventory(@PathVariable Long id) {
        quotationService.releaseInventory(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/convert-to-project")
    @PreAuthorize(WRITE)
    public ResponseEntity<List<Project>> convertToProject(@PathVariable Long id, @RequestParam(required = false) String splitBy) {
        return ResponseEntity.ok(quotationService.convertToProject(id, splitBy, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/sign")
    @PreAuthorize(WRITE)
    public ResponseEntity<Quotation> saveSignature(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(quotationService.saveSignature(id, payload.get("signature"), currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(DELETE)
    public ResponseEntity<Void> deleteQuotation(@PathVariable Long id) {
        quotationService.deleteQuotation(id);
        return ResponseEntity.ok().build();
    }

    @SuppressWarnings("unchecked")
    private List<Long> extractIds(Map<String, Object> payload) {
        List<Object> raw = (List<Object>) payload.get("itemIds");
        return raw.stream().map(o -> Long.valueOf(o.toString())).toList();
    }
}
