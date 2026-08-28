package com.arudra.crm.controller;

import com.arudra.crm.dto.lead.*;
import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.LeadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/leads")
@CrossOrigin(origins = "*")
public class LeadController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('LEAD_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('LEAD_WRITE')";
    private static final String DELETE = "hasAuthority('ROLE_ADMIN') or hasAuthority('LEAD_DELETE')";
    private static final String ASSIGN = "hasAuthority('ROLE_ADMIN') or hasAuthority('LEAD_ASSIGN')";
    private static final String CONVERT = "hasAuthority('ROLE_ADMIN') or hasAuthority('LEAD_CONVERT')";

    @Autowired
    private LeadService leadService;

    @Autowired
    private CurrentUserService currentUserService;

    @Autowired
    private com.arudra.crm.service.LeadTaskFormService leadTaskFormService;

    /** Structured data captured by employees completing this lead's workflow tasks (the Task Data log). */
    @GetMapping("/{id}/task-submissions")
    @PreAuthorize(READ)
    public ResponseEntity<java.util.List<java.util.Map<String, Object>>> getTaskSubmissions(@PathVariable Long id) {
        return ResponseEntity.ok(leadTaskFormService.getSubmissionsForLead(id));
    }

    // =====================================================================
    // List / search / dashboard / board
    // =====================================================================

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<Lead>> getAllLeads(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String leadType,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String temperature,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) Long assignedEmployeeId,
            @RequestParam(required = false) Boolean isConverted,
            @RequestParam(required = false) BigDecimal budgetMin,
            @RequestParam(required = false) BigDecimal budgetMax,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(leadService.getLeads(search, status, stage, source, leadType,
                priority, temperature, city, assignedEmployeeId, isConverted,
                budgetMin, budgetMax, dateFrom, dateTo, sortBy, sortDir, page, size));
    }

    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<LeadDashboardDTO> getDashboardMetrics() {
        return ResponseEntity.ok(leadService.getDashboard());
    }

    @GetMapping("/board")
    @PreAuthorize(READ)
    public ResponseEntity<List<LeadBoardColumnDTO>> getBoard(
            @RequestParam(required = false) Long assignedEmployeeId) {
        return ResponseEntity.ok(leadService.getBoard(assignedEmployeeId));
    }

    @GetMapping("/reports")
    @PreAuthorize(READ)
    public ResponseEntity<LeadReportsDTO> getReports() {
        return ResponseEntity.ok(leadService.getReports());
    }

    @GetMapping("/meta")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getMeta() {
        return ResponseEntity.ok(leadService.getMeta());
    }

    @GetMapping("/assignable-users")
    @PreAuthorize(READ)
    public ResponseEntity<List<UserSummaryDTO>> getAssignableUsers() {
        return ResponseEntity.ok(leadService.getAssignableUsers());
    }

    // =====================================================================
    // CRUD
    // =====================================================================

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Lead> getLeadById(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getLeadById(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<Lead> createLead(@RequestBody Lead lead) {
        return ResponseEntity.ok(leadService.createLead(lead, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Lead> updateLead(@PathVariable Long id, @RequestBody Lead lead) {
        return ResponseEntity.ok(leadService.updateLead(id, lead, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(DELETE)
    public ResponseEntity<Void> deleteLead(@PathVariable Long id) {
        leadService.deleteLead(id, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Status / stage / assignment
    // =====================================================================

    @PutMapping("/{id}/status")
    @PreAuthorize(WRITE)
    public ResponseEntity<Lead> updateLeadStatus(@PathVariable Long id, @RequestParam String status,
            @RequestParam(required = false) String remarks) {
        return ResponseEntity.ok(
                leadService.updateLeadStatus(id, status, remarks, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/stage")
    @PreAuthorize(WRITE)
    public ResponseEntity<Lead> updateLeadStage(@PathVariable Long id, @RequestParam String stage) {
        return ResponseEntity.ok(
                leadService.updateLeadStage(id, stage, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/assignments")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<Lead> assignLead(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Long userId = Long.valueOf(payload.get("userId").toString());
        String role = payload.get("role").toString();
        return ResponseEntity.ok(
                leadService.assignLead(id, userId, role, currentUserService.getCurrentUser()));
    }

    @GetMapping("/{id}/assignments")
    @PreAuthorize(READ)
    public ResponseEntity<List<LeadAssignment>> getAssignments(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getAssignments(id));
    }

    @PutMapping("/{id}/referral")
    @PreAuthorize(WRITE)
    public ResponseEntity<Lead> updateReferral(@PathVariable Long id,
            @RequestBody LeadReferralRequest req) {
        return ResponseEntity.ok(
                leadService.updateReferral(id, req, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Follow-ups
    // =====================================================================

    @GetMapping("/{id}/follow-ups")
    @PreAuthorize(READ)
    public ResponseEntity<List<LeadFollowup>> getFollowups(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getFollowups(id));
    }

    @PostMapping("/{id}/follow-ups")
    @PreAuthorize(WRITE)
    public ResponseEntity<LeadFollowup> addFollowup(@PathVariable Long id,
            @RequestBody LeadFollowup followup) {
        return ResponseEntity.ok(
                leadService.addFollowup(id, followup, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Communications
    // =====================================================================

    @GetMapping("/{id}/communications")
    @PreAuthorize(READ)
    public ResponseEntity<List<LeadCommunication>> getCommunications(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getCommunications(id));
    }

    @PostMapping("/{id}/communications")
    @PreAuthorize(WRITE)
    public ResponseEntity<LeadCommunication> addCommunication(@PathVariable Long id,
            @RequestBody LeadCommunication communication) {
        return ResponseEntity.ok(
                leadService.addCommunication(id, communication, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Notes
    // =====================================================================

    @GetMapping("/{id}/notes")
    @PreAuthorize(READ)
    public ResponseEntity<List<LeadNote>> getNotes(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getNotes(id));
    }

    @PostMapping("/{id}/notes")
    @PreAuthorize(WRITE)
    public ResponseEntity<LeadNote> addNote(@PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(
                leadService.addNote(id, payload.get("content"), currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/notes/{noteId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteNote(@PathVariable Long id, @PathVariable Long noteId) {
        leadService.deleteNote(id, noteId, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Documents
    // =====================================================================

    @GetMapping("/{id}/documents")
    @PreAuthorize(READ)
    public ResponseEntity<List<LeadDocument>> getDocuments(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getDocuments(id));
    }

    @PostMapping("/{id}/documents")
    @PreAuthorize(WRITE)
    public ResponseEntity<LeadDocument> addDocument(@PathVariable Long id,
            @RequestBody LeadDocument document) {
        return ResponseEntity.ok(
                leadService.addDocument(id, document, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/documents/{documentId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteDocument(@PathVariable Long id, @PathVariable Long documentId) {
        leadService.deleteDocument(id, documentId, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Tasks
    // =====================================================================

    @GetMapping("/{id}/tasks")
    @PreAuthorize(READ)
    public ResponseEntity<List<LeadReminder>> getTasks(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getTasks(id));
    }

    @PostMapping("/{id}/tasks")
    @PreAuthorize(WRITE)
    public ResponseEntity<LeadReminder> addTask(@PathVariable Long id, @RequestBody LeadReminder task) {
        return ResponseEntity.ok(leadService.addTask(id, task, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/tasks/{taskId}/status")
    @PreAuthorize(WRITE)
    public ResponseEntity<LeadReminder> updateTaskStatus(@PathVariable Long id,
            @PathVariable Long taskId, @RequestParam String status) {
        return ResponseEntity.ok(
                leadService.updateTaskStatus(id, taskId, status, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Linked modules
    // =====================================================================

    @GetMapping("/{id}/site-visits")
    @PreAuthorize(READ)
    public ResponseEntity<List<SiteVisit>> getSiteVisits(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getSiteVisits(id));
    }

    @PostMapping("/{id}/site-visits")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisit> scheduleSiteVisit(@PathVariable Long id,
            @RequestBody SiteVisit visit) {
        return ResponseEntity.ok(
                leadService.scheduleSiteVisit(id, visit, currentUserService.getCurrentUser()));
    }

    @GetMapping("/{id}/measurements")
    @PreAuthorize(READ)
    public ResponseEntity<List<Measurement>> getMeasurements(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getMeasurements(id));
    }

    @GetMapping("/{id}/boqs")
    @PreAuthorize(READ)
    public ResponseEntity<List<Boq>> getBoqs(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getBoqs(id));
    }

    @GetMapping("/{id}/quotations")
    @PreAuthorize(READ)
    public ResponseEntity<List<Quotation>> getQuotations(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getQuotations(id));
    }

    @GetMapping("/{id}/projects")
    @PreAuthorize(READ)
    public ResponseEntity<List<Project>> getProjects(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getProjects(id));
    }

    // =====================================================================
    // Activity / history
    // =====================================================================

    @GetMapping("/{id}/activities")
    @PreAuthorize(READ)
    public ResponseEntity<List<LeadActivity>> getActivities(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getActivities(id));
    }

    @GetMapping("/{id}/status-history")
    @PreAuthorize(READ)
    public ResponseEntity<List<LeadStatusHistory>> getStatusHistory(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getStatusHistory(id));
    }

    // =====================================================================
    // Conversion / lost
    // =====================================================================

    /** Legacy endpoint: converts to customer only. Kept for backward compatibility. */
    @PostMapping("/{id}/convert")
    @PreAuthorize(CONVERT)
    public ResponseEntity<Customer> convertLeadToCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(
                leadService.convertLeadToCustomer(id, currentUserService.getCurrentUser()));
    }

    /** Full conversion: creates the customer and relinks all lead history. A Project is only ever
     * created later, once a quotation for this lead is approved. */
    @PostMapping("/{id}/convert-full")
    @PreAuthorize(CONVERT)
    public ResponseEntity<LeadConversionResultDTO> convertLeadFull(@PathVariable Long id,
            @RequestBody(required = false) LeadConversionRequest request) {
        return ResponseEntity.ok(
                leadService.convertLead(id, request, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/lost")
    @PreAuthorize(WRITE)
    public ResponseEntity<Lead> markLeadAsLost(@PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(leadService.markAsLost(id, payload.get("reason"),
                payload.get("competitor"), payload.get("feedback"),
                currentUserService.getCurrentUser()));
    }
}
