package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "*")
public class ProjectController {

    // Every mutating/reading endpoint carries method security. Authorities map to roles in DataSeeder.
    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('PROJECT_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('PROJECT_WRITE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('PROJECT_APPROVE')";
    private static final String DELETE = "hasAuthority('ROLE_ADMIN') or hasAuthority('PROJECT_DELETE')";

    @Autowired
    private ProjectService projectService;

    @Autowired
    private com.arudra.crm.service.QuotationService quotationService;

    @Autowired
    private CurrentUserService currentUserService;

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<Project>> getAllProjects(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(projectService.getProjects(search, category, page, size));
    }

    /** Tab badge counts for the Projects portfolio: all / new / inProgress / completed / unassigned. */
    @GetMapping("/segment-counts")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Long>> getSegmentCounts() {
        return ResponseEntity.ok(projectService.getSegmentCounts());
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getProjectDetails(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getProjectDashboard(id));
    }

    @GetMapping("/{id}/command-center-stats")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getCommandCenterStats(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getCommandCenterStats(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<Project> createProject(@RequestBody Project project) {
        return ResponseEntity.ok(projectService.createProject(project));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Project> updateProject(@PathVariable Long id, @RequestBody Project project) {
        return ResponseEntity.ok(projectService.updateProject(id, project));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(DELETE)
    public ResponseEntity<Void> deleteProject(@PathVariable Long id) {
        projectService.deleteProject(id);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/{id}/stages")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectStage> addStage(@PathVariable Long id, @RequestBody ProjectStage stage) {
        return ResponseEntity.ok(projectService.addStage(id, stage));
    }
    
    @PostMapping("/{id}/daily-logs")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectDailyLog> addDailyLog(@PathVariable Long id, @RequestBody ProjectDailyLog log) {
        return ResponseEntity.ok(projectService.addDailyLog(id, log, null));
    }
    
    @PostMapping("/{id}/quality-checks")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectQualityCheck> addQualityCheck(@PathVariable Long id, @RequestBody ProjectQualityCheck check) {
        return ResponseEntity.ok(projectService.addQualityCheck(id, check, null));
    }
    
    @PostMapping("/{id}/approvals")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectCustomerApproval> addCustomerApproval(@PathVariable Long id, @RequestBody ProjectCustomerApproval approval) {
        return ResponseEntity.ok(projectService.addCustomerApproval(id, approval));
    }

    @PostMapping("/{id}/activity-logs")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectActivityLog> addActivityLog(@PathVariable Long id, @RequestBody ProjectActivityLog log) {
        return ResponseEntity.ok(projectService.addActivityLog(id, log, null));
    }
    
    @PostMapping("/{id}/issues")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectIssue> addIssue(@PathVariable Long id, @RequestBody ProjectIssue issue) {
        return ResponseEntity.ok(projectService.addIssue(id, issue));
    }
    
    @PostMapping("/{id}/risks")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectRisk> addRisk(@PathVariable Long id, @RequestBody ProjectRisk risk) {
        return ResponseEntity.ok(projectService.addRisk(id, risk));
    }
    
    @PostMapping("/{id}/documents")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectDocument> addDocument(@PathVariable Long id, @RequestBody ProjectDocument document) {
        return ResponseEntity.ok(projectService.addDocument(id, document, null));
    }

    /** Pull this project's lead documents + linked measurement drawings/media into its Documents tab. */
    @PostMapping("/{id}/import-lead-assets")
    @PreAuthorize(WRITE)
    public ResponseEntity<Map<String, Integer>> importLeadAssets(@PathVariable Long id) {
        int imported = quotationService.importPreSalesAssets(id, currentUserService.getCurrentUser());
        return ResponseEntity.ok(Map.of("imported", imported));
    }

    /** Replace a document's file (e.g. after an admin edits the image in the in-app viewer). */
    @PutMapping("/documents/{docId}/file")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectDocument> replaceDocumentFile(@PathVariable Long docId, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(projectService.replaceDocumentFile(docId, body.get("fileUrl"), body.get("fileName")));
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectPayment> addPayment(@PathVariable Long id, @RequestBody ProjectPayment payment) {
        return ResponseEntity.ok(projectService.addPayment(id, payment, null));
    }
    
    @PostMapping("/{id}/start-execution")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Project> startExecution(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.startExecution(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Project> completeProject(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        boolean force = payload != null && "true".equalsIgnoreCase(payload.get("force"));
        return ResponseEntity.ok(projectService.completeProject(id, payload == null ? null : payload.get("certificate"), force));
    }

    /** Completion-gate readiness checklist (which §42 conditions are met / outstanding). */
    @GetMapping("/{id}/completion-readiness")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> completionReadiness(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getCompletionReadiness(id));
    }

    @GetMapping("/{id}/site-visits/summary")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getSiteVisitsSummary(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getSiteVisitsSummary(id));
    }

    // =====================================================================
    // Phases
    // =====================================================================

    // ---- Public tracking link (no-login customer page at /track/{token}) ----

    /** Returns the project's share token (generating one if missing) and whether tracking is enabled. */
    @GetMapping("/{id}/tracking")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTracking(@PathVariable Long id) {
        Project p = projectService.ensureShareToken(id);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "shareToken", p.getShareToken(), "trackingEnabled", p.isTrackingEnabled())));
    }

    /** Rotates the token, revoking any link already shared. */
    @PostMapping("/{id}/tracking/regenerate")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> regenerateTracking(@PathVariable Long id) {
        Project p = projectService.regenerateShareToken(id);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "shareToken", p.getShareToken(), "trackingEnabled", p.isTrackingEnabled()),
                "A new tracking link has been generated. Old links no longer work."));
    }

    @PutMapping("/{id}/tracking")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> setTracking(
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        boolean enabled = Boolean.parseBoolean(String.valueOf(body.get("enabled")));
        Project p = projectService.setTrackingEnabled(id, enabled);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "shareToken", p.getShareToken(), "trackingEnabled", p.isTrackingEnabled()),
                enabled ? "Public tracking enabled." : "Public tracking disabled."));
    }

    /** Reviews left by customers on the public tracking page, for moderation. */
    @GetMapping("/{id}/reviews")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ProjectReview>>> getReviews(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getReviews(id)));
    }

    @PatchMapping("/reviews/{reviewId}/status")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> setReviewStatus(
            @PathVariable Long reviewId, @RequestBody Map<String, String> body) {
        projectService.setReviewStatus(reviewId, body.get("status"));
        return ResponseEntity.ok(ApiResponse.success(null, "Review updated."));
    }

    @GetMapping("/{id}/phases")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ProjectPhase>>> getPhases(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getPhases(id)));
    }

    @PostMapping("/{id}/phases")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectPhase>> addPhase(@PathVariable Long id, @RequestBody ProjectPhase phase) {
        return ResponseEntity.ok(ApiResponse.success(projectService.addPhase(id, phase)));
    }

    @PutMapping("/phases/{phaseId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectPhase>> updatePhase(@PathVariable Long phaseId, @RequestBody ProjectPhase phase) {
        return ResponseEntity.ok(ApiResponse.success(projectService.updatePhase(phaseId, phase)));
    }

    @DeleteMapping("/phases/{phaseId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deletePhase(@PathVariable Long phaseId) {
        projectService.deletePhase(phaseId);
        return ResponseEntity.noContent().build();
    }

    // =====================================================================
    // Rooms
    // =====================================================================

    @GetMapping("/phases/{phaseId}/rooms")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ProjectRoom>>> getRooms(@PathVariable Long phaseId) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getRooms(phaseId)));
    }

    @PostMapping("/phases/{phaseId}/rooms")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectRoom>> addRoom(@PathVariable Long phaseId, @RequestBody ProjectRoom room) {
        return ResponseEntity.ok(ApiResponse.success(projectService.addRoom(phaseId, room)));
    }

    @PutMapping("/rooms/{roomId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectRoom>> updateRoom(@PathVariable Long roomId, @RequestBody ProjectRoom room) {
        return ResponseEntity.ok(ApiResponse.success(projectService.updateRoom(roomId, room)));
    }

    @DeleteMapping("/rooms/{roomId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteRoom(@PathVariable Long roomId) {
        projectService.deleteRoom(roomId);
        return ResponseEntity.noContent().build();
    }

    // =====================================================================
    // Room items
    // =====================================================================

    @GetMapping("/rooms/{roomId}/items")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ProjectRoomItem>>> getItems(@PathVariable Long roomId) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getItems(roomId)));
    }

    @PostMapping("/rooms/{roomId}/items")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectRoomItem>> addItem(@PathVariable Long roomId, @RequestBody ProjectRoomItem item) {
        return ResponseEntity.ok(ApiResponse.success(projectService.addItem(roomId, item)));
    }

    @PutMapping("/items/{itemId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectRoomItem>> updateItem(@PathVariable Long itemId, @RequestBody ProjectRoomItem item) {
        return ResponseEntity.ok(ApiResponse.success(
                projectService.updateItem(itemId, item, currentUserService.getCurrentUser())));
    }

    /** Quick work-item progress update (slider + status + note + photos). Drives the auto rollup. */
    @PutMapping("/items/{itemId}/progress")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectRoomItem>> updateItemProgress(
            @PathVariable Long itemId, @RequestBody Map<String, Object> payload) {
        Integer progress = payload.get("progress") != null ? ((Number) payload.get("progress")).intValue() : null;
        String status = (String) payload.get("status");
        String remarks = (String) payload.get("remarks");
        String photos = payload.get("photos") != null ? String.valueOf(payload.get("photos")) : null;
        return ResponseEntity.ok(ApiResponse.success(projectService.updateItemProgress(
                itemId, progress, status, remarks, photos, currentUserService.getCurrentUser())));
    }

    /** Reopen a completed/locked work item — Manager/Admin only. */
    @PostMapping("/items/{itemId}/reopen")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<ProjectRoomItem>> reopenItem(@PathVariable Long itemId) {
        return ResponseEntity.ok(ApiResponse.success(
                projectService.reopenItem(itemId, currentUserService.getCurrentUser())));
    }

    /** Full daily-progress timeline / audit history for a work item. */
    @GetMapping("/items/{itemId}/timeline")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ProjectItemProgressLog>>> getItemTimeline(@PathVariable Long itemId) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getItemTimeline(itemId)));
    }

    @DeleteMapping("/items/{itemId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteItem(@PathVariable Long itemId) {
        projectService.deleteItem(itemId);
        return ResponseEntity.noContent().build();
    }

    // =====================================================================
    // Material planning
    // =====================================================================

    @GetMapping("/{id}/materials")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ProjectMaterialRequirement>>> getMaterials(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getMaterials(id)));
    }

    @PostMapping("/{id}/materials")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectMaterialRequirement>> addMaterial(
            @PathVariable Long id, @RequestBody ProjectMaterialRequirement requirement) {
        return ResponseEntity.ok(ApiResponse.success(projectService.addMaterial(id, requirement)));
    }

    @PutMapping("/materials/{reqId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectMaterialRequirement>> updateMaterial(
            @PathVariable Long reqId, @RequestBody ProjectMaterialRequirement requirement) {
        return ResponseEntity.ok(ApiResponse.success(projectService.updateMaterial(reqId, requirement)));
    }

    @PostMapping("/materials/{reqId}/request-purchase")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<PurchaseOrder>> requestPurchase(@PathVariable Long reqId) {
        return ResponseEntity.ok(ApiResponse.success(
                projectService.requestPurchase(reqId, currentUserService.getCurrentUser())));
    }

    // Project-scoped stock movements (stock entry / stock reduce) + purchase summary

    @GetMapping("/{id}/material-transactions")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<InventoryTransaction>>> getMaterialTransactions(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getMaterialTransactions(id)));
    }

    @PostMapping("/{id}/material-transactions")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<InventoryTransaction>> recordMaterialTransaction(
            @PathVariable Long id, @RequestBody InventoryTransaction transaction) {
        return ResponseEntity.ok(ApiResponse.success(projectService.recordMaterialTransaction(id, transaction)));
    }

    @GetMapping("/{id}/material-purchase-summary")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMaterialPurchaseSummary(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getMaterialPurchaseSummary(id)));
    }

    // =====================================================================
    // Daily log children (employees present / materials used / photos+videos)
    // =====================================================================

    @GetMapping("/daily-logs/{logId}")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDailyLogDetail(@PathVariable Long logId) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getDailyLogDetail(logId)));
    }

    @PostMapping("/daily-logs/{logId}/employees")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectDailyLogEmployee>> addDailyLogEmployee(
            @PathVariable Long logId, @RequestBody ProjectDailyLogEmployee entry) {
        return ResponseEntity.ok(ApiResponse.success(projectService.addDailyLogEmployee(logId, entry)));
    }

    @PostMapping("/daily-logs/{logId}/materials")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectDailyLogMaterial>> addDailyLogMaterial(
            @PathVariable Long logId, @RequestBody ProjectDailyLogMaterial entry) {
        return ResponseEntity.ok(ApiResponse.success(projectService.addDailyLogMaterial(logId, entry)));
    }

    @PostMapping("/daily-logs/{logId}/media")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProjectDailyLogMedia>> addDailyLogMedia(
            @PathVariable Long logId, @RequestBody ProjectDailyLogMedia entry) {
        return ResponseEntity.ok(ApiResponse.success(projectService.addDailyLogMedia(logId, entry)));
    }

    // =====================================================================
    // Customer approval workflow
    // =====================================================================

    @PostMapping("/approvals/{approvalId}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<ProjectCustomerApproval>> approveApproval(
            @PathVariable Long approvalId, @RequestBody(required = false) Map<String, String> payload) {
        String remarks = payload != null ? payload.get("remarks") : null;
        return ResponseEntity.ok(ApiResponse.success(
                projectService.decideApproval(approvalId, true, remarks, currentUserService.getCurrentUser())));
    }

    @PostMapping("/approvals/{approvalId}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ApiResponse<ProjectCustomerApproval>> rejectApproval(
            @PathVariable Long approvalId, @RequestBody(required = false) Map<String, String> payload) {
        String remarks = payload != null ? payload.get("remarks") : null;
        return ResponseEntity.ok(ApiResponse.success(
                projectService.decideApproval(approvalId, false, remarks, currentUserService.getCurrentUser())));
    }

    // =====================================================================
    // Progress / dashboard / reports / BOQ generation
    // =====================================================================

    @GetMapping("/{id}/progress")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProgress(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getProgress(id)));
    }

    /** Live progress dashboard: overall %, task/room/floor/phase counts, delayed & inspection counts. */
    @GetMapping("/{id}/progress-dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProgressDashboard(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getProgressDashboard(id)));
    }

    @PostMapping("/{id}/generate-from-boq")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> generateFromBoq(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                projectService.reconcileProjectWithBoq(id, currentUserService.getCurrentUser())));
    }

    /** People (employees + contractors) assigned across this project's tasks — the Labour roster. */
    @GetMapping("/{id}/resources")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getProjectResources(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getProjectResources(id)));
    }

    /** Approved quotations for this project's lead — the candidate scopes the Phases tab builds from. */
    @GetMapping("/{id}/available-quotations")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAvailableQuotations(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getAvailableQuotations(id)));
    }

    /** Re-point the project at a chosen approved quotation (and its BOQ), then build phases/rooms/materials. */
    @PostMapping("/{id}/generate-from-quotation")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> generateFromQuotation(
            @PathVariable Long id, @RequestParam Long quotationId) {
        return ResponseEntity.ok(ApiResponse.success(
                projectService.generateFromQuotation(id, quotationId, currentUserService.getCurrentUser())));
    }

    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getModuleDashboard() {
        return ResponseEntity.ok(ApiResponse.success(projectService.getModuleDashboard()));
    }

    @GetMapping("/reports/progress")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> reportProgress(@RequestParam Long projectId) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getProgress(projectId)));
    }

    @GetMapping("/reports/budget-vs-actual")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> reportBudgetVsActual() {
        return ResponseEntity.ok(ApiResponse.success(projectService.reportBudgetVsActual()));
    }

    @GetMapping("/reports/material-consumption")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> reportMaterialConsumption(
            @RequestParam(required = false) Long projectId) {
        return ResponseEntity.ok(ApiResponse.success(projectService.reportMaterialConsumption(projectId)));
    }

    @GetMapping("/reports/labour-cost")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> reportLabourCost() {
        return ResponseEntity.ok(ApiResponse.success(projectService.reportLabourCost()));
    }

    @GetMapping("/reports/employee-performance")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> reportEmployeePerformance() {
        return ResponseEntity.ok(ApiResponse.success(projectService.reportEmployeePerformance()));
    }

    @GetMapping("/reports/contractor-performance")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> reportContractorPerformance() {
        return ResponseEntity.ok(ApiResponse.success(projectService.reportContractorPerformance()));
    }

    @GetMapping("/reports/profit-analysis")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> reportProfitAnalysis() {
        return ResponseEntity.ok(ApiResponse.success(projectService.reportProfitAnalysis()));
    }

    @GetMapping("/reports/delayed-projects")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> reportDelayedProjects() {
        return ResponseEntity.ok(ApiResponse.success(projectService.reportDelayedProjects()));
    }
}
