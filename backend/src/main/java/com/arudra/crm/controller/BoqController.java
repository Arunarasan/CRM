package com.arudra.crm.controller;

import com.arudra.crm.dto.boq.BoqDashboardDTO;
import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.BoqService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/boq")
@CrossOrigin(origins = "*")
public class BoqController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('BOQ_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('BOQ_WRITE')";
    private static final String DELETE = "hasAuthority('ROLE_ADMIN') or hasAuthority('BOQ_DELETE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('BOQ_APPROVE')";

    private final BoqService boqService;
    private final CurrentUserService currentUserService;

    public BoqController(BoqService boqService, CurrentUserService currentUserService) {
        this.boqService = boqService;
        this.currentUserService = currentUserService;
    }

    // =====================================================================
    // List / search / dashboard / meta
    // =====================================================================

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<Boq>> getAllBoqs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Boolean latestOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(boqService.getBoqs(search, status, customerId, projectId, latestOnly, page, size));
    }

    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<BoqDashboardDTO> getDashboard() {
        return ResponseEntity.ok(boqService.getDashboard());
    }

    @GetMapping("/meta")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getMeta() {
        return ResponseEntity.ok(boqService.getMeta());
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Boq> getBoq(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getBoqById(id));
    }

    @GetMapping("/customer/{customerId}")
    @PreAuthorize(READ)
    public ResponseEntity<List<Boq>> getByCustomer(@PathVariable Long customerId) {
        return ResponseEntity.ok(boqService.getByCustomer(customerId));
    }

    @GetMapping("/project/{projectId}")
    @PreAuthorize(READ)
    public ResponseEntity<List<Boq>> getByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(boqService.getByProject(projectId));
    }

    @GetMapping("/measurement/{measurementId}")
    @PreAuthorize(READ)
    public ResponseEntity<List<Boq>> getByMeasurement(@PathVariable Long measurementId) {
        return ResponseEntity.ok(boqService.getByMeasurement(measurementId));
    }

    @GetMapping("/lead/{leadId}")
    @PreAuthorize(READ)
    public ResponseEntity<List<Boq>> getByLead(@PathVariable Long leadId) {
        return ResponseEntity.ok(boqService.getByLead(leadId));
    }

    @GetMapping("/{id}/master")
    @PreAuthorize(READ)
    public ResponseEntity<Boq> getMaster(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.resolveMasterBoq(id));
    }

    // =====================================================================
    // CRUD
    // =====================================================================

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<Boq> createBoq(@RequestBody Boq boq) {
        return ResponseEntity.ok(boqService.createBoq(boq, currentUserService.getCurrentUser()));
    }

    @PostMapping("/from-measurement/{measurementId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Boq> createFromMeasurement(@PathVariable Long measurementId) {
        return ResponseEntity.ok(boqService.createFromMeasurement(measurementId, currentUserService.getCurrentUser()));
    }

    /** Pulls rooms/items added to the source measurement since this BOQ was generated. */
    @PostMapping("/{id}/sync-from-measurement")
    @PreAuthorize(WRITE)
    public ResponseEntity<Map<String, Object>> syncFromMeasurement(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.syncFromMeasurement(id, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Boq> updateBoq(@PathVariable Long id, @RequestBody Boq boq) {
        return ResponseEntity.ok(boqService.updateBoq(id, boq, currentUserService.getCurrentUser()));
    }

    /**
     * Edit only the pricing totals — body { discountType, discount, taxPercent, materialTotalOverride,
     * labourTotalOverride }. Omitted keys are left unchanged; a null material/labour override clears it
     * and restores auto-summing. Kept separate from the full update so it never touches the item list.
     */
    @PutMapping("/{id}/totals")
    @PreAuthorize(WRITE)
    public ResponseEntity<Boq> updateTotals(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(boqService.updateTotals(id, body, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(DELETE)
    public ResponseEntity<Void> deleteBoq(@PathVariable Long id) {
        boqService.deleteBoq(id, currentUserService.getCurrentUser());
        return ResponseEntity.noContent().build();
    }

    // =====================================================================
    // Items (floor / room / item)
    // =====================================================================

    @PostMapping("/{id}/items")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqItem> addItem(@PathVariable Long id, @RequestBody BoqItem item) {
        return ResponseEntity.ok(boqService.addItem(id, item, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/items/{itemId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqItem> updateItem(@PathVariable Long id, @PathVariable Long itemId,
            @RequestBody BoqItem item, @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(boqService.updateItem(id, itemId, item, reason, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/items/{itemId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteItem(@PathVariable Long id, @PathVariable Long itemId) {
        boqService.deleteItem(id, itemId, currentUserService.getCurrentUser());
        return ResponseEntity.noContent().build();
    }

    /**
     * Drag-and-drop layout: body { "items": [{ "itemId", "floorName", "roomName" }] } in final visual
     * order. Re-parents items and stamps floor/room/item order from their position.
     */
    @SuppressWarnings("unchecked")
    @PostMapping("/{id}/reorder")
    @PreAuthorize(WRITE)
    public ResponseEntity<Boq> reorderItems(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> raw = (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        List<BoqService.ReorderEntry> entries = raw.stream()
                .map(m -> new BoqService.ReorderEntry(
                        ((Number) m.get("itemId")).longValue(),
                        (String) m.get("floorName"),
                        (String) m.get("roomName")))
                .toList();
        return ResponseEntity.ok(boqService.reorderItems(id, entries, currentUserService.getCurrentUser()));
    }

    /** Soft disable/enable a single item — preserves history, unlike delete. */
    @PutMapping("/{id}/items/{itemId}/toggle-active")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqItem> toggleItemActive(@PathVariable Long id, @PathVariable Long itemId,
            @RequestBody Map<String, Object> payload) {
        boolean active = !Boolean.FALSE.equals(payload.get("active"));
        String reason = payload.get("reason") != null ? payload.get("reason").toString() : null;
        return ResponseEntity.ok(boqService.toggleItemActive(id, itemId, active, reason, currentUserService.getCurrentUser()));
    }

    /** Bulk disable/enable every item in a (phase, room) — models "Remove/Add Room" without losing history. */
    @PutMapping("/{id}/rooms/toggle-active")
    @PreAuthorize(WRITE)
    public ResponseEntity<List<BoqItem>> toggleRoomActive(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Long phaseId = Long.valueOf(payload.get("phaseId").toString());
        String roomName = payload.get("roomName").toString();
        boolean active = !Boolean.FALSE.equals(payload.get("active"));
        String reason = payload.get("reason") != null ? payload.get("reason").toString() : null;
        return ResponseEntity.ok(boqService.toggleRoomActive(id, phaseId, roomName, active, reason, currentUserService.getCurrentUser()));
    }

    /** Bulk-moves every item in a (phase, room) to a different phase — "Move rooms between floors". */
    @PostMapping("/{id}/rooms/move")
    @PreAuthorize(WRITE)
    public ResponseEntity<List<BoqItem>> moveRoom(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Long phaseId = Long.valueOf(payload.get("phaseId").toString());
        String roomName = payload.get("roomName").toString();
        Long targetPhaseId = Long.valueOf(payload.get("targetPhaseId").toString());
        return ResponseEntity.ok(boqService.moveRoom(id, phaseId, roomName, targetPhaseId, currentUserService.getCurrentUser()));
    }

    /** Bulk checkbox selection from the floor/room/item tree — marks items SELECTED (or back to PENDING). */
    @PostMapping("/{id}/items/select")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> selectItems(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        @SuppressWarnings("unchecked")
        List<Object> rawIds = (List<Object>) payload.get("itemIds");
        List<Long> itemIds = rawIds.stream().map(o -> Long.valueOf(o.toString())).toList();
        boolean selected = !Boolean.FALSE.equals(payload.get("selected"));
        boqService.selectItems(id, itemIds, selected, currentUserService.getCurrentUser());
        return ResponseEntity.noContent().build();
    }

    // =====================================================================
    // Materials
    // =====================================================================

    @PostMapping("/{id}/items/{itemId}/materials")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqItemMaterial> addMaterial(@PathVariable Long id, @PathVariable Long itemId, @RequestBody BoqItemMaterial material) {
        return ResponseEntity.ok(boqService.addMaterial(id, itemId, material, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/items/{itemId}/materials/{materialId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqItemMaterial> updateMaterial(@PathVariable Long id, @PathVariable Long itemId,
            @PathVariable Long materialId, @RequestBody BoqItemMaterial material,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(boqService.updateMaterial(id, itemId, materialId, material, reason, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/items/{itemId}/materials/{materialId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteMaterial(@PathVariable Long id, @PathVariable Long itemId, @PathVariable Long materialId) {
        boqService.deleteMaterial(id, itemId, materialId, currentUserService.getCurrentUser());
        return ResponseEntity.noContent().build();
    }

    // =====================================================================
    // Labour
    // =====================================================================

    @PostMapping("/{id}/items/{itemId}/labour")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqItemLabour> addLabour(@PathVariable Long id, @PathVariable Long itemId, @RequestBody BoqItemLabour labour) {
        return ResponseEntity.ok(boqService.addLabour(id, itemId, labour, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/items/{itemId}/labour/{labourId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqItemLabour> updateLabour(@PathVariable Long id, @PathVariable Long itemId,
            @PathVariable Long labourId, @RequestBody BoqItemLabour labour,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(boqService.updateLabour(id, itemId, labourId, labour, reason, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/items/{itemId}/labour/{labourId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteLabour(@PathVariable Long id, @PathVariable Long itemId, @PathVariable Long labourId) {
        boqService.deleteLabour(id, itemId, labourId, currentUserService.getCurrentUser());
        return ResponseEntity.noContent().build();
    }

    // =====================================================================
    // Phases
    // =====================================================================

    @GetMapping("/{id}/phases")
    @PreAuthorize(READ)
    public ResponseEntity<List<BoqPhase>> getPhases(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getPhases(id));
    }

    @PostMapping("/{id}/phases")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqPhase> addPhase(@PathVariable Long id, @RequestBody BoqPhase phase) {
        return ResponseEntity.ok(boqService.addPhase(id, phase, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}/phases/{phaseId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqPhase> updatePhase(@PathVariable Long id, @PathVariable Long phaseId,
            @RequestBody BoqPhase phase, @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(boqService.updatePhase(id, phaseId, phase, reason, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/{id}/phases/{phaseId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deletePhase(@PathVariable Long id, @PathVariable Long phaseId) {
        boqService.deletePhase(id, phaseId, currentUserService.getCurrentUser());
        return ResponseEntity.noContent().build();
    }

    /** Soft disable/enable a whole phase (e.g. customer drops a floor) — preserves history, unlike delete. */
    @PutMapping("/{id}/phases/{phaseId}/toggle-active")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqPhase> togglePhaseActive(@PathVariable Long id, @PathVariable Long phaseId,
            @RequestBody Map<String, Object> payload) {
        boolean active = !Boolean.FALSE.equals(payload.get("active"));
        String reason = payload.get("reason") != null ? payload.get("reason").toString() : null;
        return ResponseEntity.ok(boqService.togglePhaseActive(id, phaseId, active, reason, currentUserService.getCurrentUser()));
    }

    /** "Split Work into Phases" — moves the given items into a brand-new phase. */
    @PostMapping("/{id}/phases/split")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqPhase> splitPhase(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Long sourcePhaseId = Long.valueOf(payload.get("sourcePhaseId").toString());
        String newPhaseName = payload.get("newPhaseName").toString();
        @SuppressWarnings("unchecked")
        List<Object> rawIds = (List<Object>) payload.get("itemIds");
        List<Long> itemIds = rawIds.stream().map(o -> Long.valueOf(o.toString())).toList();
        return ResponseEntity.ok(boqService.splitPhase(id, sourcePhaseId, newPhaseName, itemIds, currentUserService.getCurrentUser()));
    }

    /** "Merge Phases" — moves every item from phase B into phase A and disables B. */
    @PostMapping("/{id}/phases/merge")
    @PreAuthorize(WRITE)
    public ResponseEntity<BoqPhase> mergePhases(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Long phaseIdA = Long.valueOf(payload.get("phaseIdA").toString());
        Long phaseIdB = Long.valueOf(payload.get("phaseIdB").toString());
        return ResponseEntity.ok(boqService.mergePhases(id, phaseIdA, phaseIdB, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Clone / revisions / compare
    // =====================================================================

    @PostMapping("/{id}/clone")
    @PreAuthorize(WRITE)
    public ResponseEntity<Boq> cloneBoq(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.cloneBoq(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/revisions")
    @PreAuthorize(WRITE)
    public ResponseEntity<Boq> createRevision(@PathVariable Long id, @RequestBody(required = false) Map<String, String> payload) {
        String reason = payload != null ? payload.get("reason") : null;
        return ResponseEntity.ok(boqService.createRevision(id, reason, currentUserService.getCurrentUser()));
    }

    @GetMapping("/{id}/revisions")
    @PreAuthorize(READ)
    public ResponseEntity<List<Boq>> getRevisionFamily(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getRevisionFamily(id));
    }

    @GetMapping("/compare")
    @PreAuthorize(READ)
    public ResponseEntity<List<Boq>> compareVersions(@RequestParam Long a, @RequestParam Long b) {
        return ResponseEntity.ok(boqService.compareVersions(a, b));
    }

    /** Real item/phase-level diff between two revisions (added/removed/changed + totals delta). */
    @GetMapping("/compare/detailed")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> compareVersionsDetailed(@RequestParam Long a, @RequestParam Long b) {
        return ResponseEntity.ok(boqService.compareVersionsDetailed(a, b));
    }

    // =====================================================================
    // Approval workflow
    // =====================================================================

    @PostMapping("/{id}/submit-for-review")
    @PreAuthorize(WRITE)
    public ResponseEntity<Boq> submitForReview(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.submitForReview(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Boq> approveBoq(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.approveBoq(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Boq> rejectBoq(@PathVariable Long id, @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(boqService.rejectBoq(id, reason, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Integration: generate quotation (full house / partial / budget)
    // =====================================================================

    @PostMapping("/{id}/generate-quotation")
    @PreAuthorize(WRITE)
    public ResponseEntity<Quotation> generateQuotation(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> payload) {
        String mode = payload != null && payload.get("mode") != null ? payload.get("mode").toString() : "FULL_HOUSE";
        List<Long> itemIds = null;
        if (payload != null && payload.get("itemIds") != null) {
            @SuppressWarnings("unchecked")
            List<Object> raw = (List<Object>) payload.get("itemIds");
            itemIds = raw.stream().map(o -> Long.valueOf(o.toString())).toList();
        }
        BigDecimal budgetCap = payload != null && payload.get("budgetCap") != null
                ? new BigDecimal(payload.get("budgetCap").toString()) : null;
        return ResponseEntity.ok(boqService.generateQuotationFromBoq(id, mode, itemIds, budgetCap, currentUserService.getCurrentUser()));
    }

    // =====================================================================
    // Reports
    // =====================================================================

    @GetMapping("/{id}/reports/room-wise-cost")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> roomWiseCost(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getRoomWiseCost(id));
    }

    @GetMapping("/{id}/reports/floor-wise-cost")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> floorWiseCost(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getFloorWiseCost(id));
    }

    @GetMapping("/{id}/reports/material-consumption")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> materialConsumption(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getMaterialConsumption(id));
    }

    @GetMapping("/{id}/reports/inventory-requirement")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> inventoryRequirement(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getInventoryRequirement(id));
    }

    @GetMapping("/{id}/reports/labour-cost")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> labourCost(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getLabourCost(id));
    }

    @GetMapping("/{id}/reports/profit")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> profit(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getProfitReport(id));
    }

    @GetMapping("/{id}/reports/pending-work")
    @PreAuthorize(READ)
    public ResponseEntity<List<BoqItem>> pendingWork(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getPendingWork(id));
    }

    @GetMapping("/{id}/reports/approved-work")
    @PreAuthorize(READ)
    public ResponseEntity<List<BoqItem>> approvedWork(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getApprovedWork(id));
    }

    // =====================================================================
    // Activity log
    // =====================================================================

    @GetMapping("/{id}/activity-log")
    @PreAuthorize(READ)
    public ResponseEntity<List<BoqActivityLog>> getActivityLog(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getActivityLog(id));
    }

    /** Field-level edit history (Modified By/Date/Reason/Previous/New Value) — the "Editable BOQ" audit trail. */
    @GetMapping("/{id}/change-log")
    @PreAuthorize(READ)
    public ResponseEntity<List<BoqChangeLog>> getChangeLog(@PathVariable Long id) {
        return ResponseEntity.ok(boqService.getChangeLog(id));
    }
}
