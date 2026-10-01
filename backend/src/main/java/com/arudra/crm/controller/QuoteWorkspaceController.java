package com.arudra.crm.controller;

import com.arudra.crm.entity.Quotation;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.QuoteWorkspaceService;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** The lead's combined Measurement & Quotation workspace — see {@link QuoteWorkspaceService}. */
@RestController
@RequestMapping("/api/quote-workspace")
@CrossOrigin(origins = "*")
public class QuoteWorkspaceController {

    // Pricing access is what the workspace is about; skipping the in-between approvals is deliberate.
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('BOQ_WRITE')";

    private final QuoteWorkspaceService service;
    private final CurrentUserService currentUserService;

    public QuoteWorkspaceController(QuoteWorkspaceService service, CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    /** Opens the pricing sheet for a lead, creating the measurement and BOQ when missing. */
    @PostMapping("/lead/{leadId}/start-pricing")
    @PreAuthorize(WRITE)
    public ResponseEntity<Map<String, Object>> startPricing(@PathVariable Long leadId) {
        try {
            return ResponseEntity.ok(service.startPricing(leadId, currentUserService.getCurrentUser()));
        } catch (CannotAcquireLockException | DataIntegrityViolationException e) {
            // Idempotent (finds-or-creates): a lock conflict, or losing a race with a parallel call that
            // created the measurement/BOQ first (unique-number clash), is safe to retry once — the retry
            // finds what the other call created.
            return ResponseEntity.ok(service.startPricing(leadId, currentUserService.getCurrentUser()));
        }
    }

    /** Finishes the measurement, approves the pricing and raises the full quotation in one step. */
    @PostMapping("/boq/{boqId}/generate-quotation")
    @PreAuthorize(WRITE)
    public ResponseEntity<Quotation> generateQuotation(@PathVariable Long boqId) {
        return ResponseEntity.ok(service.generateQuotation(boqId, currentUserService.getCurrentUser()));
    }
}
