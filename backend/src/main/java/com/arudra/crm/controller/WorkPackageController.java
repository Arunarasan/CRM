package com.arudra.crm.controller;

import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ContractorExecutionService;
import com.arudra.crm.service.WorkPackageService;
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
 * Work packages and everything executed against them — assignment, material issue,
 * daily progress, quality inspection, attendance, safety and scope changes.
 *
 * <p>Every endpoint is package-scoped by design: there is no way to hand a contractor a project.
 */
@RestController
@RequestMapping("/api/work-packages")
@CrossOrigin(origins = "*")
public class WorkPackageController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORK_PACKAGE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORK_PACKAGE_WRITE')";
    private static final String ASSIGN = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORK_PACKAGE_ASSIGN')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORK_PACKAGE_APPROVE')";
    private static final String EXECUTE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORK_PACKAGE_EXECUTE') "
            + "or hasAuthority('WORK_PACKAGE_WRITE')";
    private static final String ISSUE_MATERIAL = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_MATERIAL_ISSUE')";

    @Autowired private WorkPackageService workPackageService;
    @Autowired private ContractorExecutionService executionService;
    @Autowired private CurrentUserService currentUserService;

    // =====================================================================
    // Request bodies
    // =====================================================================

    public static class WorkPackageRequest {
        public ContractorWorkPackage workPackage;
        public Long projectId;
        public Long phaseId;
        public Long roomId;
        public Long boqId;
        public List<Long> boqItemIds;
    }

    public static class AssignmentRequest {
        public Long contractorId;
        public WorkPackageAssignment assignment;
    }

    public static class MaterialIssueRequest {
        public Long contractorId;
        public Long warehouseId;
        public ContractorMaterialIssue issue;
        public List<ContractorMaterialIssueItem> items;
    }

    public static class ProgressRequest {
        public Long contractorId;
        public ContractorDailyProgress progress;
        public List<ContractorProgressMedia> media;
    }

    public static class InspectionRequest {
        public ContractorQualityInspection inspection;
        public List<ContractorProgressMedia> media;
    }

    // =====================================================================
    // Package CRUD
    // =====================================================================

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<ContractorWorkPackage>> search(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long phaseId,
            @RequestParam(required = false) Long roomId,
            @RequestParam(required = false) Long contractorId,
            @RequestParam(required = false) String trade,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(workPackageService.search(projectId, phaseId, roomId, contractorId,
                trade, status, search, page, size));
    }

    @GetMapping("/by-project/{projectId}")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorWorkPackage>> getByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(workPackageService.getByProject(projectId));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(workPackageService.getWorkPackageDetail(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorWorkPackage> create(@RequestBody WorkPackageRequest request) {
        return ResponseEntity.ok(workPackageService.createWorkPackage(
                request.workPackage, request.projectId, request.phaseId, request.roomId,
                request.boqId, request.boqItemIds, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorWorkPackage> update(@PathVariable Long id,
                                                        @RequestBody WorkPackageRequest request) {
        return ResponseEntity.ok(workPackageService.updateWorkPackage(id, request.workPackage,
                request.phaseId, request.roomId, request.boqId));
    }

    /** Automation: one draft package per phase/room/trade bucket of the project's approved BOQ. */
    @PostMapping("/generate-from-boq/{projectId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Map<String, Object>> generateFromBoq(@PathVariable Long projectId) {
        return ResponseEntity.ok(workPackageService.generateFromBoq(projectId, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Items (BOQ linkage)
    // =====================================================================

    @GetMapping("/{id}/items")
    @PreAuthorize(READ)
    public ResponseEntity<List<WorkPackageItem>> getItems(@PathVariable Long id) {
        return ResponseEntity.ok(workPackageService.getItems(id));
    }

    @PostMapping("/{id}/items/boq")
    @PreAuthorize(WRITE)
    public ResponseEntity<List<WorkPackageItem>> addBoqItems(@PathVariable Long id,
                                                              @RequestBody List<Long> boqItemIds) {
        return ResponseEntity.ok(workPackageService.addBoqItems(id, boqItemIds));
    }

    @PostMapping("/{id}/items")
    @PreAuthorize(WRITE)
    public ResponseEntity<WorkPackageItem> addManualItem(@PathVariable Long id,
                                                          @RequestBody WorkPackageItem item) {
        return ResponseEntity.ok(workPackageService.addManualItem(id, item));
    }

    @PutMapping("/items/{itemId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<WorkPackageItem> updateItem(@PathVariable Long itemId,
                                                       @RequestBody WorkPackageItem item) {
        return ResponseEntity.ok(workPackageService.updateItem(itemId, item));
    }

    @DeleteMapping("/items/{itemId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> removeItem(@PathVariable Long itemId) {
        workPackageService.removeItem(itemId);
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Assignment
    // =====================================================================

    @GetMapping("/{id}/assignments")
    @PreAuthorize(READ)
    public ResponseEntity<List<WorkPackageAssignment>> getAssignments(@PathVariable Long id) {
        return ResponseEntity.ok(workPackageService.getAssignments(id));
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<WorkPackageAssignment> assign(@PathVariable Long id,
                                                         @RequestBody AssignmentRequest request) {
        return ResponseEntity.ok(workPackageService.assignContractor(id, request.contractorId,
                request.assignment != null ? request.assignment : new WorkPackageAssignment(),
                currentUserService.getCurrentUser()));
    }

    @PostMapping("/assignments/{assignmentId}/accept")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<WorkPackageAssignment> accept(@PathVariable Long assignmentId,
                                                         @RequestParam(required = false) String remarks) {
        return ResponseEntity.ok(workPackageService.acceptAssignment(assignmentId, remarks));
    }

    @PostMapping("/assignments/{assignmentId}/reject")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<WorkPackageAssignment> reject(@PathVariable Long assignmentId,
                                                         @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(workPackageService.rejectAssignment(assignmentId, reason));
    }

    @PostMapping("/assignments/{assignmentId}/terminate")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<WorkPackageAssignment> terminate(@PathVariable Long assignmentId,
                                                            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(workPackageService.terminateAssignment(assignmentId, reason));
    }

    // =====================================================================
    // Lifecycle
    // =====================================================================

    @PostMapping("/{id}/start")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ContractorWorkPackage> start(@PathVariable Long id) {
        return ResponseEntity.ok(workPackageService.startWork(id));
    }

    @PostMapping("/{id}/hold")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ContractorWorkPackage> hold(@PathVariable Long id,
                                                       @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(workPackageService.holdWork(id, reason));
    }

    @PostMapping("/{id}/work-completed")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ContractorWorkPackage> workCompleted(@PathVariable Long id) {
        return ResponseEntity.ok(workPackageService.markWorkCompleted(id));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ContractorWorkPackage> complete(@PathVariable Long id) {
        return ResponseEntity.ok(workPackageService.completeWorkPackage(id));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ContractorWorkPackage> cancel(@PathVariable Long id,
                                                         @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(workPackageService.cancelWorkPackage(id, reason));
    }

    @PostMapping("/{id}/recompute")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorWorkPackage> recompute(@PathVariable Long id) {
        workPackageService.recomputeFinancials(id);
        return ResponseEntity.ok(workPackageService.recomputeCompletion(id));
    }

    // =====================================================================
    // Material issue
    // =====================================================================

    @GetMapping("/{id}/material-issues")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorMaterialIssue>> getIssues(@PathVariable Long id) {
        return ResponseEntity.ok(executionService.getIssuesForPackage(id));
    }

    @GetMapping("/material-issues/{issueId}")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getIssueDetail(@PathVariable Long issueId) {
        return ResponseEntity.ok(executionService.getIssueDetail(issueId));
    }

    @PostMapping("/{id}/material-issues")
    @PreAuthorize(ISSUE_MATERIAL)
    public ResponseEntity<ContractorMaterialIssue> createIssue(@PathVariable Long id,
                                                                @RequestBody MaterialIssueRequest request) {
        return ResponseEntity.ok(executionService.createIssue(id, request.contractorId, request.warehouseId,
                request.issue != null ? request.issue : new ContractorMaterialIssue(),
                request.items, currentUserService.getCurrentUser()));
    }

    @PostMapping("/material-issues/{issueId}/confirm")
    @PreAuthorize(ISSUE_MATERIAL)
    public ResponseEntity<ContractorMaterialIssue> confirmIssue(@PathVariable Long issueId) {
        return ResponseEntity.ok(executionService.confirmIssue(issueId));
    }

    @PostMapping("/material-issues/{issueId}/reconcile")
    @PreAuthorize(ISSUE_MATERIAL)
    public ResponseEntity<ContractorMaterialIssue> reconcileIssue(
            @PathVariable Long issueId, @RequestBody List<ContractorMaterialIssueItem> lines) {
        return ResponseEntity.ok(executionService.reconcileIssue(issueId, lines));
    }

    @PostMapping("/material-issues/{issueId}/cancel")
    @PreAuthorize(ISSUE_MATERIAL)
    public ResponseEntity<ContractorMaterialIssue> cancelIssue(@PathVariable Long issueId,
                                                                @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(executionService.cancelIssue(issueId, reason));
    }

    // =====================================================================
    // Daily progress
    // =====================================================================

    @GetMapping("/{id}/progress")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorDailyProgress>> getProgress(@PathVariable Long id) {
        return ResponseEntity.ok(executionService.getProgressForPackage(id));
    }

    @GetMapping("/progress/today")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorDailyProgress>> getTodaysProgress() {
        return ResponseEntity.ok(executionService.getTodaysProgress());
    }

    @GetMapping("/progress/{progressId}/media")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorProgressMedia>> getProgressMedia(@PathVariable Long progressId) {
        return ResponseEntity.ok(executionService.getProgressMedia(progressId));
    }

    @PostMapping("/{id}/progress")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ContractorDailyProgress> recordProgress(@PathVariable Long id,
                                                                   @RequestBody ProgressRequest request) {
        return ResponseEntity.ok(executionService.recordProgress(id, request.contractorId,
                request.progress, request.media, currentUserService.getCurrentUser()));
    }

    @PostMapping("/progress/{progressId}/verify")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ContractorDailyProgress> verifyProgress(
            @PathVariable Long progressId,
            @RequestParam(defaultValue = "true") boolean approve,
            @RequestParam(required = false) String remarks) {
        return ResponseEntity.ok(executionService.verifyProgress(progressId, approve, remarks,
                currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Quality inspection
    // =====================================================================

    @GetMapping("/{id}/inspections")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorQualityInspection>> getInspections(@PathVariable Long id) {
        return ResponseEntity.ok(executionService.getInspectionsForPackage(id));
    }

    @GetMapping("/inspections/open-issues")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorQualityInspection>> getOpenQualityIssues() {
        return ResponseEntity.ok(executionService.getOpenQualityIssues());
    }

    @PostMapping("/{id}/inspections")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ContractorQualityInspection> recordInspection(@PathVariable Long id,
                                                                         @RequestBody InspectionRequest request) {
        return ResponseEntity.ok(executionService.recordInspection(id, request.inspection, request.media,
                currentUserService.getCurrentUser()));
    }

    @PostMapping("/inspections/{inspectionId}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ContractorQualityInspection> approveInspection(
            @PathVariable Long inspectionId, @RequestParam(required = false) String comments) {
        return ResponseEntity.ok(executionService.approveInspection(inspectionId, comments,
                currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Attendance & safety
    // =====================================================================

    @GetMapping("/{id}/attendance")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorAttendance>> getAttendance(@PathVariable Long id) {
        return ResponseEntity.ok(executionService.getAttendanceForPackage(id));
    }

    @GetMapping("/attendance/by-contractor/{contractorId}")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorAttendance>> getContractorAttendance(
            @PathVariable Long contractorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(executionService.getAttendanceForContractor(contractorId, from, to));
    }

    @PostMapping("/{id}/attendance")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ContractorAttendance> recordAttendance(@PathVariable Long id,
                                                                  @RequestParam Long contractorId,
                                                                  @RequestBody ContractorAttendance attendance) {
        return ResponseEntity.ok(executionService.recordAttendance(contractorId, id, attendance,
                currentUserService.getCurrentUser()));
    }

    @GetMapping("/{id}/safety")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorSafetyRecord>> getSafety(@PathVariable Long id) {
        return ResponseEntity.ok(executionService.getSafetyForPackage(id));
    }

    @PostMapping("/{id}/safety")
    @PreAuthorize(EXECUTE)
    public ResponseEntity<ContractorSafetyRecord> recordSafety(@PathVariable Long id,
                                                                @RequestParam Long contractorId,
                                                                @RequestBody ContractorSafetyRecord record) {
        return ResponseEntity.ok(executionService.recordSafety(contractorId, id, record,
                currentUserService.getCurrentUser()));
    }

    @PostMapping("/safety/{recordId}/close")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ContractorSafetyRecord> closeSafety(@PathVariable Long recordId,
                                                               @RequestParam(required = false) String actionTaken) {
        return ResponseEntity.ok(executionService.closeSafetyRecord(recordId, actionTaken));
    }

    // =====================================================================
    // Scope changes
    // =====================================================================

    @GetMapping("/{id}/changes")
    @PreAuthorize(READ)
    public ResponseEntity<List<WorkPackageChange>> getChanges(@PathVariable Long id) {
        return ResponseEntity.ok(workPackageService.getChanges(id));
    }

    @PostMapping("/{id}/changes")
    @PreAuthorize(WRITE)
    public ResponseEntity<WorkPackageChange> createChange(@PathVariable Long id,
                                                           @RequestBody WorkPackageChange change) {
        return ResponseEntity.ok(workPackageService.createChange(id, change, currentUserService.getCurrentUser()));
    }

    @PostMapping("/changes/{changeId}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<WorkPackageChange> approveChange(@PathVariable Long changeId) {
        return ResponseEntity.ok(workPackageService.approveChange(changeId, currentUserService.getCurrentUser()));
    }

    @PostMapping("/changes/{changeId}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<WorkPackageChange> rejectChange(@PathVariable Long changeId,
                                                           @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(workPackageService.rejectChange(changeId, reason,
                currentUserService.getCurrentUser()));
    }
}
