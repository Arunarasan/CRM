package com.arudra.crm.controller;

import com.arudra.crm.dto.sitevisit.*;
import com.arudra.crm.entity.*;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.UserRepository;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.SiteVisitService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/site-visits")
@CrossOrigin(origins = "*")
public class SiteVisitController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('SITE_VISIT_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('SITE_VISIT_WRITE')";
    private static final String DELETE = "hasAuthority('ROLE_ADMIN') or hasAuthority('SITE_VISIT_DELETE')";
    private static final String ASSIGN = "hasAuthority('ROLE_ADMIN') or hasAuthority('SITE_VISIT_ASSIGN')";

    @Autowired
    private SiteVisitService siteVisitService;

    @Autowired
    private CurrentUserService currentUserService;

    @Autowired
    private UserRepository userRepository;

    // =====================================================================
    // List / search / dashboard / meta
    // =====================================================================

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<SiteVisitListItemDTO>> getSiteVisits(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String visitType,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        LocalDateTime start = startDate != null ? LocalDateTime.parse(startDate) : null;
        LocalDateTime end = endDate != null ? LocalDateTime.parse(endDate) : null;

        Page<SiteVisit> result = siteVisitService.getSiteVisits(status, visitType, priority, projectId,
                customerId, employeeId, start, end, page, size);
        return ResponseEntity.ok(result.map(SiteVisitListItemDTO::from));
    }

    @GetMapping("/all")
    @PreAuthorize(READ)
    public ResponseEntity<List<SiteVisit>> getAllSiteVisits(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        LocalDateTime start = startDate != null ? LocalDateTime.parse(startDate) : null;
        LocalDateTime end = endDate != null ? LocalDateTime.parse(endDate) : null;

        return ResponseEntity.ok(siteVisitService.getAllSiteVisits(status, start, end));
    }

    @GetMapping("/today")
    @PreAuthorize(READ)
    public ResponseEntity<List<SiteVisitListItemDTO>> getTodaysVisits() {
        return ResponseEntity.ok(siteVisitService.getTodaysVisits().stream()
                .map(SiteVisitListItemDTO::from).toList());
    }

    @GetMapping("/search")
    @PreAuthorize(READ)
    public ResponseEntity<Page<SiteVisitListItemDTO>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(siteVisitService.searchVisits(q, page, size).map(SiteVisitListItemDTO::from));
    }

    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<SiteVisitDashboardDTO> getDashboard() {
        return ResponseEntity.ok(siteVisitService.getDashboard());
    }

    @GetMapping("/meta")
    @PreAuthorize(READ)
    public ResponseEntity<Object> getMeta() {
        return ResponseEntity.ok(siteVisitService.getMeta());
    }

    // =====================================================================
    // CRUD
    // =====================================================================

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<SiteVisitDTO> getSiteVisitById(@PathVariable Long id) {
        return ResponseEntity.ok(SiteVisitDTO.from(siteVisitService.getSiteVisitById(id)));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitDTO> createSiteVisit(@RequestBody SiteVisit siteVisit) {
        SiteVisit saved = siteVisitService.createSiteVisit(siteVisit, currentUserService.getCurrentUser());
        return ResponseEntity.ok(SiteVisitDTO.from(saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitDTO> updateSiteVisit(@PathVariable Long id, @RequestBody SiteVisit siteVisit) {
        SiteVisit saved = siteVisitService.updateSiteVisit(id, siteVisit, currentUserService.getCurrentUser());
        return ResponseEntity.ok(SiteVisitDTO.from(saved));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(DELETE)
    public ResponseEntity<Void> deleteSiteVisit(@PathVariable Long id) {
        siteVisitService.deleteSiteVisit(id, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Status transitions
    // =====================================================================

    @PutMapping("/{id}/start")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitDTO> startVisit(@PathVariable Long id) {
        return ResponseEntity.ok(SiteVisitDTO.from(siteVisitService.startVisit(id, currentUserService.getCurrentUser())));
    }

    @PutMapping("/{id}/complete")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitDTO> completeVisit(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        SiteVisit saved = siteVisitService.completeVisit(id, payload.get("outcome"), payload.get("nextActionNotes"),
                currentUserService.getCurrentUser());
        return ResponseEntity.ok(SiteVisitDTO.from(saved));
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitDTO> cancelVisit(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        SiteVisit saved = siteVisitService.cancelVisit(id, payload.get("reason"), currentUserService.getCurrentUser());
        return ResponseEntity.ok(SiteVisitDTO.from(saved));
    }

    @PutMapping("/{id}/reschedule")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitDTO> rescheduleVisit(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        LocalDateTime newTime = LocalDateTime.parse(payload.get("newTime"));
        String reason = payload.get("reason");
        SiteVisit saved = siteVisitService.rescheduleVisit(id, newTime, reason, currentUserService.getCurrentUser());
        return ResponseEntity.ok(SiteVisitDTO.from(saved));
    }

    @PostMapping("/{id}/follow-up")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitDTO> scheduleFollowUp(@PathVariable Long id) {
        SiteVisit saved = siteVisitService.scheduleFollowUp(id, currentUserService.getCurrentUser());
        return ResponseEntity.ok(SiteVisitDTO.from(saved));
    }

    @PutMapping("/{id}/sign")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitDTO> signVisit(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String base64Signature = payload.get("signature");
        String customerName = payload.get("customerName");
        SiteVisit saved = siteVisitService.updateSignature(id, base64Signature, customerName, currentUserService.getCurrentUser());
        return ResponseEntity.ok(SiteVisitDTO.from(saved));
    }

    // =====================================================================
    // Assignments
    // =====================================================================

    @PostMapping("/{id}/assignments")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<SiteVisitAssignmentDTO> assignUser(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Long userId = Long.valueOf(payload.get("userId").toString());
        String role = payload.get("role").toString();
        String remarks = payload.get("remarks") != null ? payload.get("remarks").toString() : null;
        User assignee = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        SiteVisitAssignment saved = siteVisitService.assignUser(id, assignee, currentUserService.getCurrentUser(), role, remarks);
        return ResponseEntity.ok(SiteVisitAssignmentDTO.from(saved));
    }

    @GetMapping("/{id}/assignments")
    @PreAuthorize(READ)
    public ResponseEntity<List<SiteVisitAssignmentDTO>> getAssignments(@PathVariable Long id) {
        return ResponseEntity.ok(siteVisitService.getAssignments(id).stream()
                .map(SiteVisitAssignmentDTO::from).toList());
    }

    @DeleteMapping("/{id}/assignments/{assignmentId}")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<Void> removeAssignment(@PathVariable Long id, @PathVariable Long assignmentId) {
        siteVisitService.removeAssignment(id, assignmentId, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/assignments/{assignmentId}/accept")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitAssignmentDTO> acceptAssignment(@PathVariable Long id, @PathVariable Long assignmentId) {
        return ResponseEntity.ok(SiteVisitAssignmentDTO.from(
                siteVisitService.acceptAssignment(id, assignmentId, currentUserService.getCurrentUser())));
    }

    @PutMapping("/{id}/assignments/{assignmentId}/arrive")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitAssignmentDTO> markArrival(@PathVariable Long id, @PathVariable Long assignmentId) {
        return ResponseEntity.ok(SiteVisitAssignmentDTO.from(
                siteVisitService.markArrival(id, assignmentId, currentUserService.getCurrentUser())));
    }

    @PutMapping("/{id}/assignments/{assignmentId}/complete")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitAssignmentDTO> completeAssignment(@PathVariable Long id, @PathVariable Long assignmentId) {
        return ResponseEntity.ok(SiteVisitAssignmentDTO.from(
                siteVisitService.completeAssignment(id, assignmentId, currentUserService.getCurrentUser())));
    }

    // =====================================================================
    // Rooms / measurements (unchanged sub-resource)
    // =====================================================================

    @PostMapping("/{id}/rooms")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteRoom> addRoom(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(siteVisitService.addRoom(id, payload.get("roomName")));
    }

    @GetMapping("/{id}/rooms")
    @PreAuthorize(READ)
    public ResponseEntity<List<SiteRoom>> getRooms(@PathVariable Long id) {
        return ResponseEntity.ok(siteVisitService.getRooms(id));
    }

    @PostMapping("/rooms/{roomId}/measurements")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteMeasurement> addMeasurement(@PathVariable Long roomId, @RequestBody SiteMeasurement measurement) {
        return ResponseEntity.ok(siteVisitService.addMeasurement(roomId, measurement, currentUserService.getCurrentUser()));
    }

    @GetMapping("/rooms/{roomId}/measurements")
    @PreAuthorize(READ)
    public ResponseEntity<List<SiteMeasurement>> getMeasurements(@PathVariable Long roomId) {
        return ResponseEntity.ok(siteVisitService.getMeasurements(roomId));
    }

    // =====================================================================
    // Media
    // =====================================================================

    @PostMapping("/{id}/media")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitMediaDTO> addMedia(@PathVariable Long id, @RequestBody SiteVisitMedia media) {
        SiteVisitMedia saved = siteVisitService.addMedia(id, media, currentUserService.getCurrentUser());
        return ResponseEntity.ok(SiteVisitMediaDTO.from(saved));
    }

    @GetMapping("/{id}/media")
    @PreAuthorize(READ)
    public ResponseEntity<List<SiteVisitMediaDTO>> getMedia(@PathVariable Long id) {
        return ResponseEntity.ok(siteVisitService.getMedia(id).stream().map(SiteVisitMediaDTO::from).toList());
    }

    // =====================================================================
    // Checklist
    // =====================================================================

    @GetMapping("/{id}/checklist")
    @PreAuthorize(READ)
    public ResponseEntity<List<SiteVisitChecklist>> getChecklist(@PathVariable Long id) {
        return ResponseEntity.ok(siteVisitService.getChecklist(id));
    }

    @PutMapping("/{id}/checklist/{checklistId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<SiteVisitChecklist> updateChecklistItem(@PathVariable Long id, @PathVariable Long checklistId,
            @RequestBody Map<String, Object> payload) {
        boolean completed = Boolean.TRUE.equals(payload.get("isCompleted"));
        String remarks = payload.get("remarks") != null ? payload.get("remarks").toString() : null;
        return ResponseEntity.ok(siteVisitService.updateChecklistItem(id, checklistId, completed, remarks,
                currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // History
    // =====================================================================

    @GetMapping("/{id}/history")
    @PreAuthorize(READ)
    public ResponseEntity<List<SiteVisitHistoryDTO>> getHistory(@PathVariable Long id) {
        return ResponseEntity.ok(siteVisitService.getHistory(id).stream().map(SiteVisitHistoryDTO::from).toList());
    }
}
