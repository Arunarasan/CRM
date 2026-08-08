package com.arudra.crm.controller;

import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ContractorLedgerService;
import com.arudra.crm.service.ContractorReportService;
import com.arudra.crm.service.ContractorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Contractor master, ledger, dashboard and reports.
 *
 * <p>Work packages, execution and billing live on their own surfaces
 * ({@code /api/work-packages}, {@code /api/contractor-bills}) — this controller is deliberately
 * limited to who the contractor is and what they are owed.
 */
@RestController
@RequestMapping("/api/contractors")
@CrossOrigin(origins = "*")
public class ContractorController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_WRITE')";
    private static final String DELETE = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_DELETE')";

    @Autowired private ContractorService contractorService;
    @Autowired private ContractorReportService reportService;
    @Autowired private ContractorLedgerService ledgerService;
    @Autowired private CurrentUserService currentUserService;

    // =====================================================================
    // Master
    // =====================================================================

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<Contractor>> getAllContractors(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String trade,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) BigDecimal minRating,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (trade == null && status == null && minRating == null) {
            // Preserve the original list behaviour for existing callers.
            return ResponseEntity.ok(contractorService.getContractors(search, page, size));
        }
        return ResponseEntity.ok(contractorService.search(search, trade, status, minRating, page, size));
    }

    /** Trade and contractor-type vocabularies, so the UI never hardcodes them. */
    @GetMapping("/meta")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getMeta() {
        return ResponseEntity.ok(Map.of(
                "trades", ContractorService.TRADES,
                "contractorTypes", ContractorService.CONTRACTOR_TYPES,
                "rateTypes", List.of("PER_DAY", "PER_SQFT", "PER_RUNNING_FEET", "PER_UNIT",
                        "FIXED_CONTRACT", "MILESTONE_BASED"),
                "statuses", List.of("ACTIVE", "INACTIVE", "BLACKLISTED", "PENDING_APPROVAL")));
    }

    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getDashboard() {
        return ResponseEntity.ok(reportService.getDashboard());
    }

    @GetMapping("/compliance-alerts")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getComplianceAlerts() {
        return ResponseEntity.ok(contractorService.getComplianceAlerts());
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getContractorDetails(@PathVariable Long id) {
        return ResponseEntity.ok(contractorService.getContractorDetails(id));
    }

    @GetMapping("/{id}/basic")
    @PreAuthorize(READ)
    public ResponseEntity<Contractor> getContractor(@PathVariable Long id) {
        return ResponseEntity.ok(contractorService.getContractorById(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<Contractor> createContractor(@RequestBody Contractor contractor) {
        return ResponseEntity.ok(contractorService.createContractor(contractor));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Contractor> updateContractor(@PathVariable Long id, @RequestBody Contractor contractor) {
        return ResponseEntity.ok(contractorService.updateContractor(id, contractor));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize(WRITE)
    public ResponseEntity<Contractor> updateStatus(@PathVariable Long id,
                                                   @RequestParam String status,
                                                   @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(contractorService.updateStatus(id, status, reason));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(DELETE)
    public ResponseEntity<Void> deleteContractor(@PathVariable Long id) {
        contractorService.deleteContractor(id);
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Child records
    // =====================================================================

    @PostMapping("/{id}/projects")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorProject> addProject(@PathVariable Long id, @RequestBody ContractorProject cp) {
        return ResponseEntity.ok(contractorService.addProject(id, cp));
    }

    @PostMapping("/{id}/attendance")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorAttendance> addAttendance(@PathVariable Long id,
                                                              @RequestBody ContractorAttendance attendance) {
        return ResponseEntity.ok(contractorService.addAttendance(id, attendance));
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorPayment> addPayment(@PathVariable Long id,
                                                        @RequestBody ContractorPayment payment) {
        return ResponseEntity.ok(contractorService.addPayment(id, payment));
    }

    @GetMapping("/{id}/documents")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorDocument>> getDocuments(@PathVariable Long id) {
        return ResponseEntity.ok(contractorService.getDocuments(id));
    }

    @PostMapping("/{id}/documents")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorDocument> addDocument(@PathVariable Long id,
                                                          @RequestBody ContractorDocument document) {
        return ResponseEntity.ok(contractorService.addDocument(id, document));
    }

    @PostMapping("/documents/{documentId}/verify")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorDocument> verifyDocument(@PathVariable Long documentId) {
        return ResponseEntity.ok(contractorService.verifyDocument(documentId, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/documents/{documentId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteDocument(@PathVariable Long documentId) {
        contractorService.deleteDocument(documentId);
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Ledger & performance
    // =====================================================================

    @GetMapping("/{id}/ledger")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getLedger(
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ledgerService.getLedger(id, from, to));
    }

    @GetMapping("/{id}/performance")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getPerformance(@PathVariable Long id) {
        return ResponseEntity.ok(contractorService.getPerformance(id));
    }

    /** Project-wise payment rollup: contract value / paid / pending / status per project. */
    @GetMapping("/{id}/project-payments")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> getProjectPayments(@PathVariable Long id) {
        return ResponseEntity.ok(contractorService.getProjectWisePayments(id));
    }

    // =====================================================================
    // Reports
    // =====================================================================

    @GetMapping("/reports/performance")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> reportPerformance() {
        return ResponseEntity.ok(reportService.reportPerformance());
    }

    @GetMapping("/reports/delayed-works")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> reportDelayedWorks() {
        return ResponseEntity.ok(reportService.reportDelayedWorks());
    }

    @GetMapping("/reports/cost-analysis")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> reportCostAnalysis(
            @RequestParam(required = false) Long projectId) {
        return ResponseEntity.ok(reportService.reportCostAnalysis(projectId));
    }

    @GetMapping("/reports/payment-summary")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> reportPaymentSummary() {
        return ResponseEntity.ok(reportService.reportPaymentSummary());
    }

    @GetMapping("/reports/outstanding-bills")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> reportOutstandingBills() {
        return ResponseEntity.ok(reportService.reportOutstandingBills());
    }

    @GetMapping("/reports/material-consumption")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> reportMaterialConsumption(
            @RequestParam(required = false) Long contractorId,
            @RequestParam(required = false) Long projectId) {
        return ResponseEntity.ok(reportService.reportMaterialConsumption(contractorId, projectId));
    }

    @GetMapping("/reports/quality")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> reportQuality(
            @RequestParam(required = false) Long contractorId,
            @RequestParam(required = false) Long projectId) {
        return ResponseEntity.ok(reportService.reportQuality(contractorId, projectId));
    }

    @GetMapping("/reports/attendance")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> reportAttendance(
            @RequestParam(required = false) Long contractorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.reportAttendance(contractorId, from, to));
    }

    @GetMapping("/reports/safety")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> reportSafety(
            @RequestParam(required = false) Long contractorId) {
        return ResponseEntity.ok(reportService.reportSafety(contractorId));
    }
}
