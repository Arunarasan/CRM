package com.arudra.crm.controller;

import com.arudra.crm.dto.lead.UserSummaryDTO;
import com.arudra.crm.dto.measurement.MeasurementDashboardDTO;
import com.arudra.crm.dto.measurement.MeasurementTimelineEventDTO;
import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.MeasurementService;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/measurements")
@CrossOrigin(origins = "*")
public class MeasurementController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('MEASUREMENT_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('MEASUREMENT_WRITE')";
    private static final String DELETE = "hasAuthority('ROLE_ADMIN') or hasAuthority('MEASUREMENT_DELETE')";
    private static final String ASSIGN = "hasAuthority('ROLE_ADMIN') or hasAuthority('MEASUREMENT_ASSIGN')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('MEASUREMENT_APPROVE')";

    private final MeasurementService measurementService;
    private final CurrentUserService currentUserService;

    public MeasurementController(MeasurementService measurementService, CurrentUserService currentUserService) {
        this.measurementService = measurementService;
        this.currentUserService = currentUserService;
    }

    // =====================================================================
    // List / search / dashboard / meta
    // =====================================================================

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<Measurement>> getAllMeasurements(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String measurementType,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long leadId,
            @RequestParam(required = false) Long engineerId,
            @RequestParam(required = false) Boolean latestOnly,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(measurementService.getMeasurements(search, status, measurementType, priority,
                customerId, projectId, leadId, engineerId, latestOnly, dateFrom, dateTo, sortBy, sortDir, page, size));
    }

    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<MeasurementDashboardDTO> getDashboard() {
        return ResponseEntity.ok(measurementService.getDashboard());
    }

    @GetMapping("/meta")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getMeta() {
        return ResponseEntity.ok(measurementService.getMeta());
    }

    @GetMapping("/assignable-employees")
    @PreAuthorize(READ)
    public ResponseEntity<List<UserSummaryDTO>> getAssignableEmployees() {
        return ResponseEntity.ok(measurementService.getAssignableEmployees());
    }

    // =====================================================================
    // CRUD
    // =====================================================================

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Measurement> getMeasurementById(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getMeasurementById(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<Measurement> createMeasurement(@RequestBody Measurement measurement) {
        return ResponseEntity.ok(measurementService.createMeasurement(measurement, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Measurement> updateMeasurement(@PathVariable Long id, @RequestBody Measurement measurement) {
        return ResponseEntity.ok(measurementService.updateMeasurement(id, measurement, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(DELETE)
    public ResponseEntity<Void> deleteMeasurement(@PathVariable Long id) {
        measurementService.deleteMeasurement(id, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Employee assignment
    // =====================================================================

    @GetMapping("/{id}/assignments")
    @PreAuthorize(READ)
    public ResponseEntity<List<MeasurementAssignment>> getAssignments(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getAssignments(id));
    }

    @PostMapping("/{id}/assignments")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<MeasurementAssignment> assignEmployee(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Long employeeId = Long.valueOf(payload.get("employeeId").toString());
        String role = payload.get("role").toString();
        String remarks = payload.get("remarks") != null ? payload.get("remarks").toString() : null;
        return ResponseEntity.ok(
                measurementService.assignEmployee(id, employeeId, role, remarks, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/assignments/{assignmentId}/accept")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementAssignment> acceptAssignment(@PathVariable Long id, @PathVariable Long assignmentId) {
        return ResponseEntity.ok(
                measurementService.acceptAssignment(id, assignmentId, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/assignments/{assignmentId}/complete")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementAssignment> completeAssignment(@PathVariable Long id, @PathVariable Long assignmentId) {
        return ResponseEntity.ok(
                measurementService.completeAssignment(id, assignmentId, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/assignments/{assignmentId}")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<Void> removeAssignment(@PathVariable Long id, @PathVariable Long assignmentId) {
        measurementService.removeAssignment(id, assignmentId, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Rooms
    // =====================================================================

    @GetMapping("/{id}/rooms")
    @PreAuthorize(READ)
    public ResponseEntity<List<MeasurementRoom>> getRooms(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getRoomsForMeasurement(id));
    }

    @GetMapping("/{id}/rooms/{roomId}")
    @PreAuthorize(READ)
    public ResponseEntity<MeasurementRoom> getRoom(@PathVariable Long id, @PathVariable Long roomId) {
        return ResponseEntity.ok(measurementService.getRoomById(id, roomId));
    }

    @PostMapping("/{id}/rooms")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementRoom> addRoom(@PathVariable Long id, @RequestBody MeasurementRoom room) {
        return ResponseEntity.ok(measurementService.addRoomToMeasurement(id, room, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/rooms/{roomId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementRoom> updateRoom(@PathVariable Long id, @PathVariable Long roomId,
            @RequestBody MeasurementRoom room) {
        return ResponseEntity.ok(measurementService.updateRoom(id, roomId, room, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/rooms/{roomId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteRoom(@PathVariable Long id, @PathVariable Long roomId) {
        measurementService.deleteRoom(id, roomId, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Room items
    // =====================================================================

    @GetMapping("/{id}/rooms/{roomId}/items")
    @PreAuthorize(READ)
    public ResponseEntity<List<MeasurementItem>> getItems(@PathVariable Long id, @PathVariable Long roomId) {
        return ResponseEntity.ok(measurementService.getItems(id, roomId));
    }

    @PostMapping("/{id}/rooms/{roomId}/items")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementItem> addItem(@PathVariable Long id, @PathVariable Long roomId,
            @RequestBody MeasurementItem item) {
        return ResponseEntity.ok(measurementService.addItem(id, roomId, item, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/rooms/{roomId}/items/{itemId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementItem> updateItem(@PathVariable Long id, @PathVariable Long roomId,
            @PathVariable Long itemId, @RequestBody MeasurementItem item) {
        return ResponseEntity.ok(
                measurementService.updateItem(id, roomId, itemId, item, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/rooms/{roomId}/items/{itemId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteItem(@PathVariable Long id, @PathVariable Long roomId, @PathVariable Long itemId) {
        measurementService.deleteItem(id, roomId, itemId, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Bottom-up entry: draft items (no room yet), move item, merge rooms
    // =====================================================================

    /** Adds an item before any room is chosen — it lands in the measurement's "Unassigned" bucket. */
    @PostMapping("/{id}/items")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementItem> addDraftItem(@PathVariable Long id, @RequestBody MeasurementItem item) {
        return ResponseEntity.ok(measurementService.addDraftItem(id, item, currentUserService.getCurrentUser()));
    }

    /** Reassigns an item to a different room. Body: { "targetRoomId": <id> }. */
    @PutMapping("/{id}/items/{itemId}/move")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementItem> moveItem(@PathVariable Long id, @PathVariable Long itemId,
            @RequestBody Map<String, Long> body) {
        return ResponseEntity.ok(
                measurementService.moveItem(id, itemId, body.get("targetRoomId"), currentUserService.getCurrentUser()));
    }

    /** Merges one room into another. Body: { "sourceRoomId": <id>, "targetRoomId": <id> }. */
    @PostMapping("/{id}/rooms/merge")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementRoom> mergeRooms(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        return ResponseEntity.ok(measurementService.mergeRooms(id, body.get("sourceRoomId"), body.get("targetRoomId"),
                currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Drawings
    // =====================================================================

    @GetMapping("/{id}/drawings")
    @PreAuthorize(READ)
    public ResponseEntity<List<MeasurementDrawing>> getDrawings(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getDrawings(id));
    }

    @PostMapping("/{id}/drawings")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementDrawing> addDrawing(@PathVariable Long id, @RequestBody MeasurementDrawing drawing) {
        return ResponseEntity.ok(measurementService.addDrawing(id, drawing, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/drawings/{drawingId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteDrawing(@PathVariable Long id, @PathVariable Long drawingId) {
        measurementService.deleteDrawing(id, drawingId, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Media (photos, videos, voice notes)
    // =====================================================================

    @GetMapping("/{id}/media")
    @PreAuthorize(READ)
    public ResponseEntity<List<MeasurementMedia>> getMedia(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getMedia(id));
    }

    @PostMapping("/{id}/media")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementMedia> addMedia(@PathVariable Long id, @RequestBody MeasurementMedia media) {
        return ResponseEntity.ok(measurementService.addMedia(id, media, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/media/{mediaId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteMedia(@PathVariable Long id, @PathVariable Long mediaId) {
        measurementService.deleteMedia(id, mediaId, currentUserService.getCurrentUser());
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Checklist
    // =====================================================================

    @GetMapping("/{id}/checklist")
    @PreAuthorize(READ)
    public ResponseEntity<List<MeasurementChecklist>> getChecklist(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getChecklist(id));
    }

    @PutMapping("/{id}/checklist/{checklistId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<MeasurementChecklist> toggleChecklistItem(@PathVariable Long id, @PathVariable Long checklistId,
            @RequestParam boolean completed) {
        return ResponseEntity.ok(
                measurementService.toggleChecklistItem(id, checklistId, completed, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Approval workflow
    // =====================================================================

    @PutMapping("/{id}/start")
    @PreAuthorize(WRITE)
    public ResponseEntity<Measurement> startMeasurement(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.startMeasurement(id, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/submit")
    @PreAuthorize(WRITE)
    public ResponseEntity<Measurement> submitForReview(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.submitForReview(id, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Measurement> approveMeasurement(@PathVariable Long id,
            @RequestParam(required = false) String remarks) {
        return ResponseEntity.ok(measurementService.approveMeasurement(id, remarks, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Measurement> requestRevision(@PathVariable Long id, @RequestParam String reason) {
        return ResponseEntity.ok(measurementService.requestRevision(id, reason, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/complete")
    @PreAuthorize(WRITE)
    public ResponseEntity<Measurement> completeMeasurement(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.completeMeasurement(id, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize(WRITE)
    public ResponseEntity<Measurement> cancelMeasurement(@PathVariable Long id,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(measurementService.cancelMeasurement(id, reason, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Revisions
    // =====================================================================

    @PostMapping("/{id}/revisions")
    @PreAuthorize(WRITE)
    public ResponseEntity<Measurement> createRevision(@PathVariable Long id, @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(measurementService.createRevision(id, reason, currentUserService.getCurrentUser()));
    }

    @GetMapping("/{id}/revisions")
    @PreAuthorize(READ)
    public ResponseEntity<List<Measurement>> getRevisionFamily(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getRevisionFamily(id));
    }

    @GetMapping("/{id}/revision-history")
    @PreAuthorize(READ)
    public ResponseEntity<List<MeasurementHistory>> getRevisionHistory(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getRevisionHistory(id));
    }

    // =====================================================================
    // Timeline / activity log
    // =====================================================================

    @GetMapping("/{id}/timeline")
    @PreAuthorize(READ)
    public ResponseEntity<List<MeasurementTimelineEventDTO>> getTimeline(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getTimeline(id));
    }

    @GetMapping("/{id}/activity-log")
    @PreAuthorize(READ)
    public ResponseEntity<List<MeasurementActivityLog>> getActivityLog(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getActivityLog(id));
    }
}
