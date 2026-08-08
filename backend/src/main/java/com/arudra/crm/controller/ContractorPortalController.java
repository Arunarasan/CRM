package com.arudra.crm.controller;

import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ContractorPortalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Contractor-facing portal. Everything is scoped to the contractor linked to the signed-in
 * user — no endpoint here takes a contractor id, so one contractor cannot read another's work.
 */
@RestController
@RequestMapping("/api/contractor-portal")
@CrossOrigin(origins = "*")
public class ContractorPortalController {

    private static final String PORTAL = "hasAuthority('ROLE_ADMIN') or hasAuthority('ROLE_CONTRACTOR') "
            + "or hasAuthority('CONTRACTOR_PORTAL')";

    @Autowired private ContractorPortalService portalService;
    @Autowired private CurrentUserService currentUserService;

    public static class ProgressRequest {
        public ContractorDailyProgress progress;
        public List<ContractorProgressMedia> media;
    }

    public static class MaterialRequestBody {
        public Long warehouseId;
        public List<Map<String, Object>> items;
        public String remarks;
    }

    @GetMapping("/dashboard")
    @PreAuthorize(PORTAL)
    public ResponseEntity<Map<String, Object>> dashboard() {
        return ResponseEntity.ok(portalService.getDashboard(currentUserService.getCurrentUser()));
    }

    @GetMapping("/me")
    @PreAuthorize(PORTAL)
    public ResponseEntity<Contractor> me() {
        return ResponseEntity.ok(portalService.requireContractor(currentUserService.getCurrentUser()));
    }

    // --- Work ---------------------------------------------------------------

    @GetMapping("/work-packages")
    @PreAuthorize(PORTAL)
    public ResponseEntity<List<ContractorWorkPackage>> myWorkPackages() {
        return ResponseEntity.ok(portalService.getMyWorkPackages(currentUserService.getCurrentUser()));
    }

    @GetMapping("/work-packages/{id}")
    @PreAuthorize(PORTAL)
    public ResponseEntity<Map<String, Object>> myWorkPackage(@PathVariable Long id) {
        return ResponseEntity.ok(portalService.getMyWorkPackage(id, currentUserService.getCurrentUser()));
    }

    @GetMapping("/assignments")
    @PreAuthorize(PORTAL)
    public ResponseEntity<List<WorkPackageAssignment>> myAssignments() {
        return ResponseEntity.ok(portalService.getMyAssignments(currentUserService.getCurrentUser()));
    }

    @PostMapping("/assignments/{assignmentId}/accept")
    @PreAuthorize(PORTAL)
    public ResponseEntity<WorkPackageAssignment> accept(@PathVariable Long assignmentId,
                                                         @RequestParam(required = false) String remarks) {
        return ResponseEntity.ok(portalService.acceptWork(assignmentId, remarks,
                currentUserService.getCurrentUser()));
    }

    @PostMapping("/assignments/{assignmentId}/reject")
    @PreAuthorize(PORTAL)
    public ResponseEntity<WorkPackageAssignment> reject(@PathVariable Long assignmentId,
                                                         @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(portalService.rejectWork(assignmentId, reason,
                currentUserService.getCurrentUser()));
    }

    // --- Progress -----------------------------------------------------------

    @GetMapping("/progress")
    @PreAuthorize(PORTAL)
    public ResponseEntity<List<ContractorDailyProgress>> myProgress() {
        return ResponseEntity.ok(portalService.getMyProgress(currentUserService.getCurrentUser()));
    }

    @PostMapping("/work-packages/{id}/progress")
    @PreAuthorize(PORTAL)
    public ResponseEntity<ContractorDailyProgress> submitProgress(@PathVariable Long id,
                                                                   @RequestBody ProgressRequest request) {
        return ResponseEntity.ok(portalService.submitProgress(id, request.progress, request.media,
                currentUserService.getCurrentUser()));
    }

    // --- Materials ----------------------------------------------------------

    @GetMapping("/material-issues")
    @PreAuthorize(PORTAL)
    public ResponseEntity<List<ContractorMaterialIssue>> myMaterialIssues() {
        return ResponseEntity.ok(portalService.getMyMaterialIssues(currentUserService.getCurrentUser()));
    }

    @GetMapping("/material-issues/{issueId}")
    @PreAuthorize(PORTAL)
    public ResponseEntity<Map<String, Object>> myMaterialIssue(@PathVariable Long issueId) {
        return ResponseEntity.ok(portalService.getMyMaterialIssue(issueId, currentUserService.getCurrentUser()));
    }

    @PostMapping("/work-packages/{id}/material-requests")
    @PreAuthorize(PORTAL)
    public ResponseEntity<MaterialRequest> requestMaterial(@PathVariable Long id,
                                                            @RequestBody MaterialRequestBody body) {
        return ResponseEntity.ok(portalService.requestMaterial(id, body.warehouseId, body.items, body.remarks,
                currentUserService.getCurrentUser()));
    }

    // --- Money --------------------------------------------------------------

    @GetMapping("/bills")
    @PreAuthorize(PORTAL)
    public ResponseEntity<List<ContractorBill>> myBills() {
        return ResponseEntity.ok(portalService.getMyBills(currentUserService.getCurrentUser()));
    }

    @GetMapping("/payments")
    @PreAuthorize(PORTAL)
    public ResponseEntity<List<ContractorPayment>> myPayments() {
        return ResponseEntity.ok(portalService.getMyPayments(currentUserService.getCurrentUser()));
    }

    @GetMapping("/ledger")
    @PreAuthorize(PORTAL)
    public ResponseEntity<Map<String, Object>> myLedger(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(portalService.getMyLedger(currentUserService.getCurrentUser(), from, to));
    }
}
