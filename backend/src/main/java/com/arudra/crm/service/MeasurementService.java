package com.arudra.crm.service;

import com.arudra.crm.dto.lead.UserSummaryDTO;
import com.arudra.crm.dto.measurement.MeasurementDashboardDTO;
import com.arudra.crm.dto.measurement.MeasurementTimelineEventDTO;
import com.arudra.crm.entity.*;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.*;
import com.arudra.crm.util.MeasurementWorkflow;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
public class MeasurementService {

    private static final Set<String> SORTABLE_FIELDS = Set.of(
            "id", "measurementNumber", "measurementDate", "status", "priority",
            "measurementType", "createdAt", "totalArea");

    private static final Set<String> STRUCTURAL_ITEM_TYPES = Set.of(
            "Wall", "Door", "Window", "Column", "Beam", "Ceiling", "Floor");

    private static final double DEFAULT_DOOR_AREA = 21.0;   // 3ft x 7ft
    private static final double DEFAULT_WINDOW_AREA = 15.0; // 3ft x 5ft

    @Autowired private MeasurementRepository measurementRepository;
    @Autowired private MeasurementRoomRepository roomRepository;
    @Autowired private MeasurementItemRepository itemRepository;
    @Autowired private MeasurementAssignmentRepository assignmentRepository;
    @Autowired private MeasurementDrawingRepository drawingRepository;
    @Autowired private MeasurementMediaRepository mediaRepository;
    @Autowired private MeasurementChecklistRepository checklistRepository;
    @Autowired private MeasurementActivityLogRepository activityLogRepository;
    @Autowired private MeasurementHistoryRepository historyRepository;
    @Autowired private SiteVisitRepository siteVisitRepository;
    @Autowired private SiteRoomRepository siteRoomRepository;
    @Autowired private SiteMeasurementRepository siteMeasurementRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private ObjectMapper objectMapper;

    // =====================================================================
    // Query / list
    // =====================================================================

    @Transactional(readOnly = true)
    public Page<Measurement> getMeasurements(String search, String status, String measurementType,
            String priority, Long customerId, Long projectId, Long leadId, Long engineerId,
            Boolean latestOnly, LocalDate dateFrom, LocalDate dateTo,
            String sortBy, String sortDir, int page, int size) {

        String sortField = (sortBy != null && SORTABLE_FIELDS.contains(sortBy)) ? sortBy : "id";
        Sort sort = "asc".equalsIgnoreCase(sortDir) ? Sort.by(sortField).ascending()
                : Sort.by(sortField).descending();
        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 200), sort);

        Specification<Measurement> spec = Specification.where(MeasurementSpecification.notDeleted())
                .and(MeasurementSpecification.hasStatus(status))
                .and(MeasurementSpecification.hasType(measurementType))
                .and(MeasurementSpecification.hasPriority(priority))
                .and(MeasurementSpecification.hasCustomer(customerId))
                .and(MeasurementSpecification.hasProject(projectId))
                .and(MeasurementSpecification.hasLead(leadId))
                .and(MeasurementSpecification.hasEngineer(engineerId))
                .and(MeasurementSpecification.latestRevisionOnly(latestOnly))
                .and(MeasurementSpecification.dateBetween(dateFrom, dateTo))
                .and(MeasurementSpecification.matchesSearch(search));

        return measurementRepository.findAll(spec, pageRequest);
    }

    @Transactional(readOnly = true)
    public List<Measurement> getAllMeasurements() {
        return measurementRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Measurement getMeasurementById(Long id) {
        return measurementRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Measurement not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public Optional<Measurement> findMeasurementById(Long id) {
        return measurementRepository.findById(id);
    }

    public Map<String, Object> getMeta() {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("types", MeasurementWorkflow.TYPES);
        meta.put("statuses", MeasurementWorkflow.STATUSES);
        meta.put("priorities", MeasurementWorkflow.PRIORITIES);
        meta.put("assignmentRoles", MeasurementWorkflow.ASSIGNMENT_ROLES);
        meta.put("drawingTypes", MeasurementWorkflow.DRAWING_TYPES);
        meta.put("mediaCategories", MeasurementWorkflow.MEDIA_CATEGORIES);
        meta.put("itemTypes", MeasurementWorkflow.ITEM_TYPES);
        meta.put("roomTypes", MeasurementWorkflow.ROOM_TYPES);
        meta.put("floorLevels", MeasurementWorkflow.FLOOR_LEVELS);
        meta.put("checklistItems", MeasurementWorkflow.CHECKLIST_ITEMS);
        return meta;
    }

    public List<UserSummaryDTO> getAssignableEmployees() {
        return userRepository.findAll().stream()
                .filter(u -> !Boolean.TRUE.equals(u.getIsDeleted()))
                .map(UserSummaryDTO::from)
                .toList();
    }

    // =====================================================================
    // CRUD
    // =====================================================================

    @Transactional
    public Measurement createMeasurement(Measurement measurement, User currentUser) {
        if (measurement.getMeasurementNumber() == null || measurement.getMeasurementNumber().isBlank()) {
            measurement.setMeasurementNumber(nextMeasurementNumber());
        }
        if (measurement.getStatus() == null || measurement.getStatus().isBlank()) {
            measurement.setStatus(MeasurementWorkflow.DRAFT);
        }
        if (measurement.getMeasurementType() == null || measurement.getMeasurementType().isBlank()) {
            measurement.setMeasurementType("Initial");
        }
        if (measurement.getRevisionNumber() == null) {
            measurement.setRevisionNumber(1);
        }
        measurement.setIsLatestRevision(true);

        // Whoever creates the measurement is the one who took it, unless they said otherwise.
        if (isBlank(measurement.getMeasuredBy()) && currentUser != null) {
            measurement.setMeasuredBy(currentUser.getName());
        }
        if (measurement.getAssignedEngineer() == null) {
            measurement.setAssignedEngineer(currentUser);
        }

        // A measurement raised off a site visit inherits everything already captured there,
        // so the engineer never re-keys property details or room names.
        SiteVisit siteVisit = resolveSiteVisit(measurement.getSiteVisit());
        if (siteVisit != null) {
            measurement.setSiteVisit(siteVisit);
            inheritFromSiteVisit(measurement, siteVisit);
        }

        Measurement saved = measurementRepository.save(measurement);
        logActivity(saved, "Created", "Measurement created", currentUser);
        seedChecklist(saved);
        if (currentUser != null && saved.getAssignedEngineer() != null
                && currentUser.getId().equals(saved.getAssignedEngineer().getId())) {
            selfAssign(saved, currentUser);
        }
        if (siteVisit != null) {
            int carried = carryForwardSiteVisitRooms(saved, siteVisit);
            if (carried > 0) {
                logActivity(saved, "Rooms Imported",
                        carried + " room(s) carried forward from site visit " + siteVisit.getVisitNumber(),
                        currentUser);
            }
        }
        return saved;
    }

    /**
     * Puts the creator on the team sheet as the measuring engineer. Deliberately not routed through
     * assignEmployee: that notifies the assignee, and nobody needs a notification about themselves.
     */
    private void selfAssign(Measurement measurement, User currentUser) {
        MeasurementAssignment assignment = new MeasurementAssignment();
        assignment.setMeasurement(measurement);
        assignment.setEmployee(currentUser);
        assignment.setRole("Measurement Engineer");
        assignment.setStatus("Accepted");
        assignment.setAssignedDate(LocalDateTime.now());
        assignment.setAcceptedTime(LocalDateTime.now());
        assignment.setAssignedBy(currentUser);
        assignmentRepository.save(assignment);
    }

    /** The payload usually carries only {"siteVisit":{"id":n}}, so reload the full row. */
    private SiteVisit resolveSiteVisit(SiteVisit stub) {
        if (stub == null || stub.getId() == null) {
            return null;
        }
        return siteVisitRepository.findById(stub.getId()).orElse(null);
    }

    /** Copies site-visit context onto the measurement, never overwriting values the user typed. */
    private void inheritFromSiteVisit(Measurement measurement, SiteVisit visit) {
        if (measurement.getLead() == null) {
            measurement.setLead(visit.getLead());
        }
        if (measurement.getCustomer() == null) {
            measurement.setCustomer(visit.getCustomer());
        }
        if (measurement.getProject() == null) {
            measurement.setProject(visit.getProject());
        }
        if (isBlank(measurement.getPropertyType())) {
            measurement.setPropertyType(visit.getPropertyType());
        }
        if (isBlank(measurement.getConstructionStage())) {
            measurement.setConstructionStage(visit.getConstructionStage());
        }
        if (measurement.getTotalFloors() == null) {
            measurement.setTotalFloors(visit.getTotalFloors());
        }
        if (measurement.getTotalArea() == null) {
            measurement.setTotalArea(visit.getAreaSqft());
        }
        if (isBlank(measurement.getSiteAddress())) {
            measurement.setSiteAddress(visit.getLocationAddress());
        }
        if (isBlank(measurement.getMapLocation())) {
            measurement.setMapLocation(visit.getMapLocation());
        }
    }

    /**
     * Turns the rooms captured during the site visit into measurement rooms, pulling across any
     * dimensions recorded on site. No-op if the measurement already has rooms.
     */
    private int carryForwardSiteVisitRooms(Measurement measurement, SiteVisit visit) {
        if (!roomRepository.findByMeasurementId(measurement.getId()).isEmpty()) {
            return 0;
        }
        List<SiteRoom> siteRooms = siteRoomRepository.findBySiteVisitId(visit.getId());
        if (siteRooms.isEmpty()) {
            return 0;
        }
        List<MeasurementRoom> created = new ArrayList<>();
        for (SiteRoom siteRoom : siteRooms) {
            MeasurementRoom room = new MeasurementRoom();
            room.setMeasurement(measurement);
            room.setRoomName(siteRoom.getRoomName());
            applySiteMeasurement(room, siteMeasurementRepository.findBySiteRoomId(siteRoom.getId()));
            computeRoomAreas(room, List.of());
            created.add(room);
        }
        roomRepository.saveAll(created);
        recomputeMeasurementTotals(measurement);
        return created.size();
    }

    /** Merges the on-site rough measurements (if any) into a freshly created measurement room. */
    private void applySiteMeasurement(MeasurementRoom room, List<SiteMeasurement> siteMeasurements) {
        if (siteMeasurements == null || siteMeasurements.isEmpty()) {
            return;
        }
        SiteMeasurement source = siteMeasurements.get(0);
        room.setLength(source.getLength());
        room.setWidth(source.getWidth());
        room.setHeight(source.getHeight());
        room.setCeilingHeight(source.getCeilingHeight());
        room.setDoorCount(source.getDoors());
        room.setWindowCount(source.getWindows());
        room.setNotes(source.getNotes());
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    @Transactional
    public Measurement updateMeasurement(Long id, Measurement updatedData, User currentUser) {
        Measurement existing = getMeasurementById(id);

        existing.setMeasurementType(updatedData.getMeasurementType() != null ? updatedData.getMeasurementType() : existing.getMeasurementType());
        existing.setPriority(updatedData.getPriority() != null ? updatedData.getPriority() : existing.getPriority());
        existing.setMeasuredBy(updatedData.getMeasuredBy());
        existing.setVerifiedBy(updatedData.getVerifiedBy());
        existing.setMeasurementDate(updatedData.getMeasurementDate());
        existing.setStartTime(updatedData.getStartTime());
        existing.setEndTime(updatedData.getEndTime());
        existing.setRemarks(updatedData.getRemarks());
        existing.setInternalNotes(updatedData.getInternalNotes());
        existing.setPropertyType(updatedData.getPropertyType());
        existing.setLocation(updatedData.getLocation());
        existing.setSiteAddress(updatedData.getSiteAddress());
        existing.setConstructionStage(updatedData.getConstructionStage());
        existing.setTotalFloors(updatedData.getTotalFloors());
        if (updatedData.getTotalArea() != null) {
            existing.setTotalArea(updatedData.getTotalArea());
        }
        existing.setMapLocation(updatedData.getMapLocation());
        existing.setCustomerRemarks(updatedData.getCustomerRemarks());
        existing.setDigitalSignature(updatedData.getDigitalSignature());
        existing.setEngineerSignature(updatedData.getEngineerSignature());

        if (updatedData.getStatus() != null && !updatedData.getStatus().equals(existing.getStatus())) {
            MeasurementWorkflow.validateTransition(existing.getStatus(), updatedData.getStatus());
            existing.setStatus(updatedData.getStatus());
        }

        Measurement saved = measurementRepository.save(existing);
        logActivity(saved, "Updated", "Measurement details updated", currentUser);
        return saved;
    }

    @Transactional
    public void deleteMeasurement(Long id, User currentUser) {
        Measurement existing = getMeasurementById(id);
        existing.setIsDeleted(true);
        existing.setDeletedAt(LocalDateTime.now());
        existing.setDeletedBy(currentUser != null ? currentUser.getEmail() : null);
        measurementRepository.save(existing);
        logActivity(existing, "Deleted", "Measurement deleted", currentUser);
    }

    private synchronized String nextMeasurementNumber() {
        List<String> latest = measurementRepository.findLatestMeasurementNumbers(PageRequest.of(0, 1));
        long next = 1;
        if (!latest.isEmpty()) {
            try {
                next = Long.parseLong(latest.get(0).substring("MS-".length())) + 1;
            } catch (NumberFormatException e) {
                return "MS-" + System.currentTimeMillis();
            }
        }
        return String.format("MS-%06d", next);
    }

    // =====================================================================
    // Employee assignment
    // =====================================================================

    @Transactional
    public MeasurementAssignment assignEmployee(Long measurementId, Long employeeId, String role,
            String remarks, User currentUser) {
        Measurement measurement = getMeasurementById(measurementId);
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + employeeId));

        MeasurementAssignment assignment = new MeasurementAssignment();
        assignment.setMeasurement(measurement);
        assignment.setEmployee(employee);
        assignment.setRole(role);
        assignment.setStatus("Assigned");
        assignment.setAssignedDate(LocalDateTime.now());
        assignment.setRemarks(remarks);
        assignment.setAssignedBy(currentUser);
        MeasurementAssignment saved = assignmentRepository.save(assignment);

        if ("Measurement Engineer".equals(role)) {
            measurement.setAssignedEngineer(employee);
        } else if ("Interior Designer".equals(role)) {
            measurement.setDesigner(employee);
        }
        if (MeasurementWorkflow.DRAFT.equals(measurement.getStatus())) {
            measurement.setStatus(MeasurementWorkflow.ASSIGNED);
        }
        measurementRepository.save(measurement);

        logActivity(measurement, "Assigned", employee.getName() + " assigned as " + role, currentUser);
        notify("Measurement assigned to you",
                measurement.getMeasurementNumber() + " assigned to you as " + role + ".",
                employee, measurement, currentUser);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<MeasurementAssignment> getAssignments(Long measurementId) {
        return assignmentRepository.findByMeasurementIdOrderByAssignedDateAsc(measurementId);
    }

    @Transactional
    public MeasurementAssignment acceptAssignment(Long measurementId, Long assignmentId, User currentUser) {
        MeasurementAssignment assignment = getOwnedAssignment(measurementId, assignmentId);
        assignment.setStatus("Accepted");
        assignment.setAcceptedTime(LocalDateTime.now());
        MeasurementAssignment saved = assignmentRepository.save(assignment);

        Measurement measurement = assignment.getMeasurement();
        if (MeasurementWorkflow.ASSIGNED.equals(measurement.getStatus())) {
            measurement.setStatus(MeasurementWorkflow.ACCEPTED);
            measurementRepository.save(measurement);
        }
        logActivity(measurement, "Accepted", assignment.getEmployee().getName() + " accepted the assignment", currentUser);
        return saved;
    }

    @Transactional
    public MeasurementAssignment completeAssignment(Long measurementId, Long assignmentId, User currentUser) {
        MeasurementAssignment assignment = getOwnedAssignment(measurementId, assignmentId);
        assignment.setStatus("Completed");
        assignment.setCompletedTime(LocalDateTime.now());
        MeasurementAssignment saved = assignmentRepository.save(assignment);
        logActivity(assignment.getMeasurement(), "Assignment Completed",
                assignment.getEmployee().getName() + " completed their assignment", currentUser);
        return saved;
    }

    @Transactional
    public void removeAssignment(Long measurementId, Long assignmentId, User currentUser) {
        MeasurementAssignment assignment = getOwnedAssignment(measurementId, assignmentId);
        assignmentRepository.delete(assignment);
        logActivity(assignment.getMeasurement(), "Assignment Removed",
                assignment.getEmployee().getName() + " removed from " + assignment.getRole(), currentUser);
    }

    private MeasurementAssignment getOwnedAssignment(Long measurementId, Long assignmentId) {
        MeasurementAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found with id: " + assignmentId));
        if (!assignment.getMeasurement().getId().equals(measurementId)) {
            throw new ResourceNotFoundException("Assignment does not belong to measurement " + measurementId);
        }
        return assignment;
    }

    // =====================================================================
    // Rooms
    // =====================================================================

    @Transactional
    public MeasurementRoom addRoomToMeasurement(Long measurementId, MeasurementRoom room, User currentUser) {
        Measurement measurement = getMeasurementById(measurementId);
        room.setMeasurement(measurement);
        computeRoomAreas(room, List.of());
        MeasurementRoom savedRoom = roomRepository.save(room);
        recomputeMeasurementTotals(measurement);
        logActivity(measurement, "Room Added", "Room added: " + room.getRoomName(), currentUser);
        return savedRoom;
    }

    @Transactional
    public MeasurementRoom updateRoom(Long measurementId, Long roomId, MeasurementRoom updated, User currentUser) {
        MeasurementRoom room = getOwnedRoom(measurementId, roomId);
        room.setRoomName(updated.getRoomName());
        room.setRoomType(updated.getRoomType());
        room.setFloorNumber(updated.getFloorNumber());
        room.setDescription(updated.getDescription());
        room.setStatus(updated.getStatus());
        room.setLength(updated.getLength());
        room.setWidth(updated.getWidth());
        room.setHeight(updated.getHeight());
        room.setCeilingHeight(updated.getCeilingHeight());
        room.setDoorCount(updated.getDoorCount());
        room.setWindowCount(updated.getWindowCount());
        room.setColumnCount(updated.getColumnCount());
        room.setBeamCount(updated.getBeamCount());
        room.setFalseCeilingRequired(updated.getFalseCeilingRequired());
        room.setFlooringRequired(updated.getFlooringRequired());
        room.setPaintingRequired(updated.getPaintingRequired());
        room.setWardrobeRequired(updated.getWardrobeRequired());
        room.setKitchenRequired(updated.getKitchenRequired());
        room.setTvUnitRequired(updated.getTvUnitRequired());
        room.setLoftRequired(updated.getLoftRequired());
        room.setStorageRequired(updated.getStorageRequired());
        room.setNotes(updated.getNotes());

        computeRoomAreas(room, itemRepository.findByRoomId(roomId));
        MeasurementRoom saved = roomRepository.save(room);
        recomputeMeasurementTotals(room.getMeasurement());
        logActivity(room.getMeasurement(), "Room Updated", "Room updated: " + room.getRoomName(), currentUser);
        return saved;
    }

    @Transactional
    public void deleteRoom(Long measurementId, Long roomId, User currentUser) {
        MeasurementRoom room = getOwnedRoom(measurementId, roomId);
        Measurement measurement = room.getMeasurement();
        roomRepository.delete(room);
        recomputeMeasurementTotals(measurement);
        logActivity(measurement, "Room Deleted", "Room removed: " + room.getRoomName(), currentUser);
    }

    @Transactional(readOnly = true)
    public List<MeasurementRoom> getRoomsForMeasurement(Long measurementId) {
        return roomRepository.findByMeasurementId(measurementId);
    }

    @Transactional(readOnly = true)
    public MeasurementRoom getRoomById(Long measurementId, Long roomId) {
        return getOwnedRoom(measurementId, roomId);
    }

    private MeasurementRoom getOwnedRoom(Long measurementId, Long roomId) {
        MeasurementRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Room not found with id: " + roomId));
        if (!room.getMeasurement().getId().equals(measurementId)) {
            throw new ResourceNotFoundException("Room does not belong to measurement " + measurementId);
        }
        return room;
    }

    // =====================================================================
    // Room items
    // =====================================================================

    @Transactional
    public MeasurementItem addItem(Long measurementId, Long roomId, MeasurementItem item, User currentUser) {
        MeasurementRoom room = getOwnedRoom(measurementId, roomId);
        item.setRoom(room);
        item.setArea(computeItemArea(item));
        MeasurementItem saved = itemRepository.save(item);

        computeRoomAreas(room, itemRepository.findByRoomId(roomId));
        roomRepository.save(room);
        recomputeMeasurementTotals(room.getMeasurement());
        logActivity(room.getMeasurement(), "Item Added",
                item.getItemType() + " added to " + room.getRoomName(), currentUser);
        return saved;
    }

    @Transactional
    public MeasurementItem updateItem(Long measurementId, Long roomId, Long itemId, MeasurementItem updated, User currentUser) {
        MeasurementRoom room = getOwnedRoom(measurementId, roomId);
        MeasurementItem item = getOwnedItem(roomId, itemId);
        item.setItemType(updated.getItemType());
        item.setItemName(updated.getItemName());
        item.setLength(updated.getLength());
        item.setWidth(updated.getWidth());
        item.setHeight(updated.getHeight());
        item.setQuantity(updated.getQuantity());
        item.setUnit(updated.getUnit());
        item.setMaterial(updated.getMaterial());
        item.setNotes(updated.getNotes());
        item.setArea(computeItemArea(item));
        MeasurementItem saved = itemRepository.save(item);

        computeRoomAreas(room, itemRepository.findByRoomId(roomId));
        roomRepository.save(room);
        recomputeMeasurementTotals(room.getMeasurement());
        return saved;
    }

    @Transactional
    public void deleteItem(Long measurementId, Long roomId, Long itemId, User currentUser) {
        MeasurementRoom room = getOwnedRoom(measurementId, roomId);
        MeasurementItem item = getOwnedItem(roomId, itemId);
        itemRepository.delete(item);

        computeRoomAreas(room, itemRepository.findByRoomId(roomId));
        roomRepository.save(room);
        recomputeMeasurementTotals(room.getMeasurement());
    }

    @Transactional(readOnly = true)
    public List<MeasurementItem> getItems(Long measurementId, Long roomId) {
        getOwnedRoom(measurementId, roomId);
        return itemRepository.findByRoomId(roomId);
    }

    private MeasurementItem getOwnedItem(Long roomId, Long itemId) {
        MeasurementItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found with id: " + itemId));
        if (!item.getRoom().getId().equals(roomId)) {
            throw new ResourceNotFoundException("Item does not belong to room " + roomId);
        }
        return item;
    }

    // =====================================================================
    // Bottom-up entry: draft items, move between rooms, merge rooms
    // =====================================================================

    /** roomType marking the per-measurement "Unassigned" bucket that holds draft items with no room yet. */
    public static final String DRAFT_ROOM_TYPE = "UNASSIGNED";
    private static final String DRAFT_ROOM_NAME = "Unassigned";

    /** Finds (or lazily creates) the measurement's single draft/unassigned room bucket. */
    private MeasurementRoom resolveDraftRoom(Measurement measurement) {
        return roomRepository.findByMeasurementIdAndRoomType(measurement.getId(), DRAFT_ROOM_TYPE)
                .stream().findFirst()
                .orElseGet(() -> {
                    MeasurementRoom draft = new MeasurementRoom();
                    draft.setMeasurement(measurement);
                    draft.setRoomName(DRAFT_ROOM_NAME);
                    draft.setRoomType(DRAFT_ROOM_TYPE);
                    return roomRepository.save(draft);
                });
    }

    /** Adds an item without choosing a room first — it lands in the "Unassigned" bucket. */
    @Transactional
    public MeasurementItem addDraftItem(Long measurementId, MeasurementItem item, User currentUser) {
        Measurement measurement = getMeasurementById(measurementId);
        MeasurementRoom draft = resolveDraftRoom(measurement);
        return addItem(measurementId, draft.getId(), item, currentUser);
    }

    /** Reassigns an item to another room; recomputes both rooms and clears an emptied draft bucket. */
    @Transactional
    public MeasurementItem moveItem(Long measurementId, Long itemId, Long targetRoomId, User currentUser) {
        MeasurementItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found with id: " + itemId));
        MeasurementRoom sourceRoom = item.getRoom();
        if (!sourceRoom.getMeasurement().getId().equals(measurementId)) {
            throw new ResourceNotFoundException("Item does not belong to measurement " + measurementId);
        }
        if (sourceRoom.getId().equals(targetRoomId)) {
            return item;
        }
        MeasurementRoom targetRoom = getOwnedRoom(measurementId, targetRoomId);
        item.setRoom(targetRoom);
        MeasurementItem saved = itemRepository.save(item);
        itemRepository.flush(); // ensure the reassignment lands before a possible source-room delete

        computeRoomAreas(targetRoom, itemRepository.findByRoomId(targetRoomId));
        roomRepository.save(targetRoom);

        List<MeasurementItem> remaining = itemRepository.findByRoomId(sourceRoom.getId());
        if (remaining.isEmpty() && DRAFT_ROOM_TYPE.equals(sourceRoom.getRoomType())) {
            roomRepository.delete(sourceRoom); // draft bucket disappears once emptied
        } else {
            computeRoomAreas(sourceRoom, remaining);
            roomRepository.save(sourceRoom);
        }
        recomputeMeasurementTotals(targetRoom.getMeasurement());
        logActivity(targetRoom.getMeasurement(), "Item Moved",
                (item.getItemType() != null ? item.getItemType() : "Item") + " moved to " + targetRoom.getRoomName(),
                currentUser);
        return saved;
    }

    /** Merges the source room into the target: items move over, the target keeps its own dimensions, source is deleted. */
    @Transactional
    public MeasurementRoom mergeRooms(Long measurementId, Long sourceRoomId, Long targetRoomId, User currentUser) {
        if (sourceRoomId.equals(targetRoomId)) {
            throw new IllegalArgumentException("Cannot merge a room into itself.");
        }
        MeasurementRoom source = getOwnedRoom(measurementId, sourceRoomId);
        MeasurementRoom target = getOwnedRoom(measurementId, targetRoomId);

        List<MeasurementItem> sourceItems = itemRepository.findByRoomId(sourceRoomId);
        for (MeasurementItem moved : sourceItems) {
            moved.setRoom(target);
        }
        itemRepository.saveAll(sourceItems);
        itemRepository.flush(); // reassign items before deleting the source room they used to point at

        String sourceName = source.getRoomName();
        roomRepository.delete(source);

        computeRoomAreas(target, itemRepository.findByRoomId(targetRoomId));
        MeasurementRoom saved = roomRepository.save(target);
        recomputeMeasurementTotals(target.getMeasurement());
        logActivity(target.getMeasurement(), "Rooms Merged",
                "Merged " + sourceName + " into " + target.getRoomName(), currentUser);
        return saved;
    }

    // =====================================================================
    // Auto calculations
    // =====================================================================

    private Double computeItemArea(MeasurementItem item) {
        int qty = item.getQuantity() != null ? item.getQuantity() : 1;
        if (item.getLength() != null && item.getWidth() != null) {
            return item.getLength() * item.getWidth() * qty;
        }
        if (item.getLength() != null && item.getHeight() != null) {
            return item.getLength() * item.getHeight() * qty;
        }
        return null;
    }

    private void computeRoomAreas(MeasurementRoom room, List<MeasurementItem> items) {
        if (room.getLength() != null && room.getWidth() != null) {
            room.setFloorArea(room.getLength() * room.getWidth());
            room.setCeilingArea(room.getFloorArea());
            room.setPerimeter(2 * (room.getLength() + room.getWidth()));
        }
        Double heightForWalls = room.getCeilingHeight() != null ? room.getCeilingHeight() : room.getHeight();
        if (room.getPerimeter() != null && heightForWalls != null) {
            room.setWallArea(room.getPerimeter() * heightForWalls);
        }

        double doorArea = items.stream()
                .filter(i -> "Door".equals(i.getItemType()) && i.getArea() != null)
                .mapToDouble(MeasurementItem::getArea).sum();
        if (doorArea == 0 && room.getDoorCount() != null) {
            doorArea = room.getDoorCount() * DEFAULT_DOOR_AREA;
        }
        room.setDoorArea(doorArea);

        double windowArea = items.stream()
                .filter(i -> "Window".equals(i.getItemType()) && i.getArea() != null)
                .mapToDouble(MeasurementItem::getArea).sum();
        if (windowArea == 0 && room.getWindowCount() != null) {
            windowArea = room.getWindowCount() * DEFAULT_WINDOW_AREA;
        }
        room.setWindowArea(windowArea);

        if (room.getWallArea() != null) {
            room.setPaintableArea(Math.max(0, room.getWallArea() - doorArea - windowArea));
        }

        room.setFalseCeilingArea(Boolean.TRUE.equals(room.getFalseCeilingRequired()) && room.getCeilingArea() != null
                ? room.getCeilingArea() : 0);
        room.setTileArea(Boolean.TRUE.equals(room.getFlooringRequired()) && room.getFloorArea() != null
                ? room.getFloorArea() : 0);

        double woodworkArea = items.stream()
                .filter(i -> "Custom".equals(i.getItemType()) && i.getArea() != null)
                .mapToDouble(MeasurementItem::getArea).sum();
        room.setWoodworkArea(woodworkArea);
    }

    private void recomputeMeasurementTotals(Measurement measurement) {
        List<MeasurementRoom> rooms = roomRepository.findByMeasurementId(measurement.getId());
        measurement.setRoomCount(rooms.size());
        measurement.setTotalFloorArea(sum(rooms, MeasurementRoom::getFloorArea));
        measurement.setTotalWallArea(sum(rooms, MeasurementRoom::getWallArea));
        measurement.setTotalCeilingArea(sum(rooms, MeasurementRoom::getCeilingArea));
        measurement.setTotalDoorArea(sum(rooms, MeasurementRoom::getDoorArea));
        measurement.setTotalWindowArea(sum(rooms, MeasurementRoom::getWindowArea));
        measurement.setTotalPaintableArea(sum(rooms, MeasurementRoom::getPaintableArea));
        measurement.setTotalFalseCeilingArea(sum(rooms, MeasurementRoom::getFalseCeilingArea));
        measurement.setTotalTileArea(sum(rooms, MeasurementRoom::getTileArea));
        measurement.setTotalWoodworkArea(sum(rooms, MeasurementRoom::getWoodworkArea));
        if (measurement.getTotalArea() == null) {
            measurement.setTotalArea(measurement.getTotalFloorArea());
        }
        measurementRepository.save(measurement);
    }

    private double sum(List<MeasurementRoom> rooms, java.util.function.Function<MeasurementRoom, Double> extractor) {
        return rooms.stream().map(extractor).filter(Objects::nonNull).mapToDouble(Double::doubleValue).sum();
    }

    // =====================================================================
    // Drawings
    // =====================================================================

    @Transactional
    public MeasurementDrawing addDrawing(Long measurementId, MeasurementDrawing drawing, User currentUser) {
        Measurement measurement = getMeasurementById(measurementId);
        drawing.setMeasurement(measurement);
        drawing.setUploadedBy(currentUser);
        MeasurementDrawing saved = drawingRepository.save(drawing);
        logActivity(measurement, "Drawing Uploaded",
                (drawing.getDrawingType() != null ? drawing.getDrawingType() : "Drawing") + " uploaded: " + drawing.getFileName(),
                currentUser);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<MeasurementDrawing> getDrawings(Long measurementId) {
        return drawingRepository.findByMeasurementId(measurementId);
    }

    @Transactional
    public void deleteDrawing(Long measurementId, Long drawingId, User currentUser) {
        MeasurementDrawing drawing = drawingRepository.findById(drawingId)
                .orElseThrow(() -> new ResourceNotFoundException("Drawing not found with id: " + drawingId));
        if (!drawing.getMeasurement().getId().equals(measurementId)) {
            throw new ResourceNotFoundException("Drawing does not belong to measurement " + measurementId);
        }
        drawingRepository.delete(drawing);
        logActivity(drawing.getMeasurement(), "Drawing Removed", "Drawing removed: " + drawing.getFileName(), currentUser);
    }

    // =====================================================================
    // Media
    // =====================================================================

    @Transactional
    public MeasurementMedia addMedia(Long measurementId, MeasurementMedia media, User currentUser) {
        Measurement measurement = getMeasurementById(measurementId);
        media.setMeasurement(measurement);
        media.setUploadedBy(currentUser);
        MeasurementMedia saved = mediaRepository.save(media);
        logActivity(measurement, "Photo Uploaded",
                (media.getCategory() != null ? media.getCategory() : media.getMediaType()) + " uploaded: " + media.getFileName(),
                currentUser);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<MeasurementMedia> getMedia(Long measurementId) {
        return mediaRepository.findByMeasurementId(measurementId);
    }

    @Transactional
    public void deleteMedia(Long measurementId, Long mediaId, User currentUser) {
        MeasurementMedia media = mediaRepository.findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media not found with id: " + mediaId));
        if (!media.getMeasurement().getId().equals(measurementId)) {
            throw new ResourceNotFoundException("Media does not belong to measurement " + measurementId);
        }
        mediaRepository.delete(media);
        logActivity(media.getMeasurement(), "Media Removed", "Media removed: " + media.getFileName(), currentUser);
    }

    // =====================================================================
    // Checklist
    // =====================================================================

    @Transactional
    public List<MeasurementChecklist> getChecklist(Long measurementId) {
        List<MeasurementChecklist> items = checklistRepository.findByMeasurementIdOrderBySortOrderAsc(measurementId);
        if (!items.isEmpty()) {
            return items;
        }
        Measurement measurement = getMeasurementById(measurementId);
        return seedChecklist(measurement);
    }

    private List<MeasurementChecklist> seedChecklist(Measurement measurement) {
        List<MeasurementChecklist> seeded = new ArrayList<>();
        int order = 0;
        for (String name : MeasurementWorkflow.CHECKLIST_ITEMS) {
            MeasurementChecklist item = new MeasurementChecklist();
            item.setMeasurement(measurement);
            item.setItemName(name);
            item.setIsCompleted(false);
            item.setSortOrder(order++);
            seeded.add(item);
        }
        return checklistRepository.saveAll(seeded);
    }

    @Transactional
    public MeasurementChecklist toggleChecklistItem(Long measurementId, Long checklistId, boolean completed, User currentUser) {
        MeasurementChecklist item = checklistRepository.findById(checklistId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found with id: " + checklistId));
        if (!item.getMeasurement().getId().equals(measurementId)) {
            throw new ResourceNotFoundException("Checklist item does not belong to measurement " + measurementId);
        }
        item.setIsCompleted(completed);
        item.setCompletedBy(completed && currentUser != null ? currentUser.getName() : null);
        item.setCompletedAt(completed ? LocalDateTime.now() : null);
        MeasurementChecklist saved = checklistRepository.save(item);
        logActivity(item.getMeasurement(), "Checklist Updated",
                item.getItemName() + (completed ? " marked complete" : " marked incomplete"), currentUser);
        return saved;
    }

    // =====================================================================
    // Approval workflow
    // =====================================================================

    @Transactional
    public Measurement startMeasurement(Long id, User currentUser) {
        Measurement measurement = getMeasurementById(id);
        MeasurementWorkflow.validateTransition(measurement.getStatus(), MeasurementWorkflow.IN_PROGRESS);
        measurement.setStatus(MeasurementWorkflow.IN_PROGRESS);
        Measurement saved = measurementRepository.save(measurement);
        logActivity(saved, "Started", "Measurement started", currentUser);
        return saved;
    }

    @Transactional
    public Measurement submitForReview(Long id, User currentUser) {
        Measurement measurement = getMeasurementById(id);
        MeasurementWorkflow.validateTransition(measurement.getStatus(), MeasurementWorkflow.UNDER_REVIEW);
        measurement.setStatus(MeasurementWorkflow.UNDER_REVIEW);
        measurement.setSubmittedAt(LocalDateTime.now());
        recomputeMeasurementTotals(measurement);
        Measurement saved = measurementRepository.save(measurement);
        logActivity(saved, "Submitted for Review", "Measurement submitted for review", currentUser);
        if (saved.getDesigner() != null) {
            notify("Measurement review pending", saved.getMeasurementNumber() + " is ready for your review.",
                    saved.getDesigner(), saved, currentUser);
        }
        return saved;
    }

    @Transactional
    public Measurement approveMeasurement(Long id, String remarks, User currentUser) {
        Measurement measurement = getMeasurementById(id);
        MeasurementWorkflow.validateTransition(measurement.getStatus(), MeasurementWorkflow.APPROVED);
        measurement.setStatus(MeasurementWorkflow.APPROVED);
        measurement.setApprovedBy(currentUser);
        measurement.setApprovedAt(LocalDateTime.now());
        measurement.setReviewedBy(currentUser);
        measurement.setReviewedAt(LocalDateTime.now());
        if (remarks != null && !remarks.isBlank()) {
            measurement.setCustomerRemarks(remarks);
        }
        Measurement saved = measurementRepository.save(measurement);
        logActivity(saved, "Approved", "Measurement approved" + (remarks != null ? ": " + remarks : ""), currentUser);
        if (saved.getAssignedEngineer() != null) {
            notify("Measurement approved", saved.getMeasurementNumber() + " has been approved.",
                    saved.getAssignedEngineer(), saved, currentUser);
        }
        return saved;
    }

    @Transactional
    public Measurement requestRevision(Long id, String reason, User currentUser) {
        Measurement measurement = getMeasurementById(id);
        MeasurementWorkflow.validateTransition(measurement.getStatus(), MeasurementWorkflow.REVISION_REQUIRED);
        measurement.setStatus(MeasurementWorkflow.REVISION_REQUIRED);
        measurement.setRejectionReason(reason);
        measurement.setReviewedBy(currentUser);
        measurement.setReviewedAt(LocalDateTime.now());
        Measurement saved = measurementRepository.save(measurement);
        logActivity(saved, "Revision Requested", reason != null ? reason : "Revision requested", currentUser);
        if (saved.getAssignedEngineer() != null) {
            notify("Revision requested", saved.getMeasurementNumber() + " needs revisions: "
                    + (reason != null ? reason : ""), saved.getAssignedEngineer(), saved, currentUser);
        }
        return saved;
    }

    @Transactional
    public Measurement completeMeasurement(Long id, User currentUser) {
        Measurement measurement = getMeasurementById(id);
        MeasurementWorkflow.validateTransition(measurement.getStatus(), MeasurementWorkflow.COMPLETED);
        measurement.setStatus(MeasurementWorkflow.COMPLETED);
        measurement.setCompletedAt(LocalDateTime.now());
        Measurement saved = measurementRepository.save(measurement);
        logActivity(saved, "Completed", "Measurement completed and ready for BOQ", currentUser);
        return saved;
    }

    @Transactional
    public Measurement cancelMeasurement(Long id, String reason, User currentUser) {
        Measurement measurement = getMeasurementById(id);
        MeasurementWorkflow.validateTransition(measurement.getStatus(), MeasurementWorkflow.CANCELLED);
        measurement.setStatus(MeasurementWorkflow.CANCELLED);
        measurement.setRemarks(reason != null ? reason : measurement.getRemarks());
        Measurement saved = measurementRepository.save(measurement);
        logActivity(saved, "Cancelled", reason != null ? reason : "Measurement cancelled", currentUser);
        return saved;
    }

    // =====================================================================
    // Revisions
    // =====================================================================

    @Transactional
    public Measurement createRevision(Long id, String reason, User currentUser) {
        Measurement original = getMeasurementById(id);

        Measurement revision = new Measurement();
        revision.setLead(original.getLead());
        revision.setCustomer(original.getCustomer());
        revision.setSiteVisit(original.getSiteVisit());
        revision.setProject(original.getProject());
        revision.setMeasurementType("Revision");
        revision.setStatus(MeasurementWorkflow.DRAFT);
        revision.setPriority(original.getPriority());
        revision.setMeasuredBy(original.getMeasuredBy());
        revision.setAssignedEngineer(original.getAssignedEngineer());
        revision.setDesigner(original.getDesigner());
        revision.setMeasurementDate(LocalDate.now());
        revision.setPropertyType(original.getPropertyType());
        revision.setLocation(original.getLocation());
        revision.setSiteAddress(original.getSiteAddress());
        revision.setConstructionStage(original.getConstructionStage());
        revision.setTotalFloors(original.getTotalFloors());
        revision.setTotalArea(original.getTotalArea());
        revision.setMapLocation(original.getMapLocation());
        revision.setRevisionNumber(original.getRevisionNumber() + 1);
        revision.setParentMeasurement(original);
        revision.setIsLatestRevision(true);
        revision.setMeasurementNumber(nextMeasurementNumber());
        Measurement savedRevision = measurementRepository.save(revision);

        for (MeasurementRoom room : roomRepository.findByMeasurementId(original.getId())) {
            MeasurementRoom clone = new MeasurementRoom();
            clone.setMeasurement(savedRevision);
            clone.setRoomName(room.getRoomName());
            clone.setRoomType(room.getRoomType());
            clone.setFloorNumber(room.getFloorNumber());
            clone.setDescription(room.getDescription());
            clone.setStatus(room.getStatus());
            clone.setLength(room.getLength());
            clone.setWidth(room.getWidth());
            clone.setHeight(room.getHeight());
            clone.setCeilingHeight(room.getCeilingHeight());
            clone.setDoorCount(room.getDoorCount());
            clone.setWindowCount(room.getWindowCount());
            clone.setColumnCount(room.getColumnCount());
            clone.setBeamCount(room.getBeamCount());
            clone.setFalseCeilingRequired(room.getFalseCeilingRequired());
            clone.setFlooringRequired(room.getFlooringRequired());
            clone.setPaintingRequired(room.getPaintingRequired());
            clone.setWardrobeRequired(room.getWardrobeRequired());
            clone.setKitchenRequired(room.getKitchenRequired());
            clone.setTvUnitRequired(room.getTvUnitRequired());
            clone.setLoftRequired(room.getLoftRequired());
            clone.setStorageRequired(room.getStorageRequired());
            clone.setNotes(room.getNotes());
            MeasurementRoom savedClone = roomRepository.save(clone);

            for (MeasurementItem item : itemRepository.findByRoomId(room.getId())) {
                MeasurementItem itemClone = new MeasurementItem();
                itemClone.setRoom(savedClone);
                itemClone.setItemType(item.getItemType());
                itemClone.setItemName(item.getItemName());
                itemClone.setLength(item.getLength());
                itemClone.setWidth(item.getWidth());
                itemClone.setHeight(item.getHeight());
                itemClone.setQuantity(item.getQuantity());
                itemClone.setUnit(item.getUnit());
                itemClone.setMaterial(item.getMaterial());
                itemClone.setNotes(item.getNotes());
                itemClone.setArea(item.getArea());
                itemRepository.save(itemClone);
            }
            computeRoomAreas(savedClone, itemRepository.findByRoomId(room.getId()));
            roomRepository.save(savedClone);
        }
        recomputeMeasurementTotals(savedRevision);
        seedChecklist(savedRevision);

        original.setIsLatestRevision(false);
        measurementRepository.save(original);

        MeasurementHistory history = new MeasurementHistory();
        history.setMeasurement(savedRevision);
        history.setVersionNumber(savedRevision.getRevisionNumber());
        history.setChangedBy(currentUser != null ? currentUser.getName() : null);
        history.setChangedAt(LocalDateTime.now());
        history.setChangeReason(reason);
        history.setPreviousValues(toJson(summarize(original)));
        history.setNewValues(toJson(summarize(savedRevision)));
        historyRepository.save(history);

        logActivity(original, "Revision Created",
                "Revision " + savedRevision.getRevisionNumber() + " created (" + savedRevision.getMeasurementNumber() + ")",
                currentUser);
        logActivity(savedRevision, "Created", "Created as revision of " + original.getMeasurementNumber(), currentUser);
        return savedRevision;
    }

    @Transactional(readOnly = true)
    public List<MeasurementHistory> getRevisionHistory(Long measurementId) {
        return historyRepository.findByMeasurementIdOrderByVersionNumberDesc(measurementId);
    }

    /** Walks parent links to find every revision in this measurement's family, newest first. */
    @Transactional(readOnly = true)
    public List<Measurement> getRevisionFamily(Long measurementId) {
        Measurement current = getMeasurementById(measurementId);
        Measurement root = current;
        while (root.getParentMeasurement() != null) {
            root = getMeasurementById(root.getParentMeasurement().getId());
        }
        List<Measurement> family = new ArrayList<>();
        family.add(root);
        collectRevisions(root.getId(), family);
        family.sort(Comparator.comparing(Measurement::getRevisionNumber).reversed());
        return family;
    }

    private void collectRevisions(Long parentId, List<Measurement> acc) {
        for (Measurement child : measurementRepository.findByParentMeasurementIdOrderByRevisionNumberDesc(parentId)) {
            acc.add(child);
            collectRevisions(child.getId(), acc);
        }
    }

    private Map<String, Object> summarize(Measurement m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("status", m.getStatus());
        map.put("measurementType", m.getMeasurementType());
        map.put("totalArea", m.getTotalArea());
        map.put("roomCount", m.getRoomCount());
        map.put("assignedEngineer", m.getAssignedEngineer() != null ? m.getAssignedEngineer().getName() : null);
        map.put("remarks", m.getRemarks());
        return map;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    // =====================================================================
    // Timeline / activity log
    // =====================================================================

    @Transactional(readOnly = true)
    public List<MeasurementTimelineEventDTO> getTimeline(Long measurementId) {
        return activityLogRepository.findByMeasurementIdOrderByActionTimeAsc(measurementId).stream()
                .map(l -> new MeasurementTimelineEventDTO(l.getActionType(), l.getDescription(),
                        l.getPerformedBy(), l.getRole(), l.getActionTime()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MeasurementActivityLog> getActivityLog(Long measurementId) {
        return activityLogRepository.findByMeasurementIdOrderByActionTimeDesc(measurementId);
    }

    // =====================================================================
    // Dashboard
    // =====================================================================

    @Transactional(readOnly = true)
    public MeasurementDashboardDTO getDashboard() {
        MeasurementDashboardDTO dto = new MeasurementDashboardDTO();
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.with(TemporalAdjusters.firstDayOfMonth());
        LocalDate monthEnd = today.with(TemporalAdjusters.lastDayOfMonth());

        dto.setTodaysMeasurements(measurementRepository.countByIsDeletedFalseAndMeasurementDate(today));
        dto.setPending(measurementRepository.countByIsDeletedFalseAndStatusIn(List.of(
                MeasurementWorkflow.DRAFT, MeasurementWorkflow.ASSIGNED,
                MeasurementWorkflow.ACCEPTED, MeasurementWorkflow.IN_PROGRESS)));
        dto.setUnderReview(measurementRepository.countByIsDeletedFalseAndStatus(MeasurementWorkflow.UNDER_REVIEW));
        dto.setCompleted(measurementRepository.countByIsDeletedFalseAndStatus(MeasurementWorkflow.COMPLETED));
        dto.setApproved(measurementRepository.countByIsDeletedFalseAndStatus(MeasurementWorkflow.APPROVED));
        dto.setRevisionRequests(measurementRepository.countByIsDeletedFalseAndStatus(MeasurementWorkflow.REVISION_REQUIRED));
        dto.setMeasurementsThisMonth(measurementRepository.countByIsDeletedFalseAndMeasurementDateBetween(monthStart, monthEnd));

        LocalDateTime monthStartTime = monthStart.atStartOfDay();
        LocalDateTime monthEndTime = monthEnd.plusDays(1).atStartOfDay();

        List<Measurement> completedThisMonth = measurementRepository.findAll(
                Specification.where(MeasurementSpecification.notDeleted())
                        .and(MeasurementSpecification.hasStatus(MeasurementWorkflow.COMPLETED)));
        OptionalDouble avgHours = completedThisMonth.stream()
                .filter(m -> m.getSubmittedAt() != null && m.getCompletedAt() != null
                        && !m.getCompletedAt().isBefore(monthStartTime) && m.getCompletedAt().isBefore(monthEndTime))
                .mapToDouble(m -> Duration.between(m.getSubmittedAt(), m.getCompletedAt()).toMinutes() / 60.0)
                .average();
        dto.setAverageCompletionHours(avgHours.isPresent() ? Math.round(avgHours.getAsDouble() * 10) / 10.0 : null);

        List<Object[]> engineerCounts = assignmentRepository.countCompletedByEmployee(monthStartTime, monthEndTime);
        if (!engineerCounts.isEmpty()) {
            Object[] top = engineerCounts.get(0);
            dto.setMostActiveEngineer((String) top[0]);
            dto.setMostActiveEngineerCount((Long) top[1]);
        }
        return dto;
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private void notify(String title, String message, User recipient, Measurement measurement, User currentUser) {
        if (recipient == null || (currentUser != null && recipient.getId().equals(currentUser.getId()))) {
            return;
        }
        notificationService.dispatch(title, message, "MEASUREMENT", recipient.getId(),
                "/measurements/" + measurement.getId());
    }

    private void logActivity(Measurement measurement, String actionType, String description, User currentUser) {
        MeasurementActivityLog log = new MeasurementActivityLog();
        log.setMeasurement(measurement);
        log.setActionType(actionType);
        log.setDescription(description);
        log.setPerformedBy(currentUser != null ? currentUser.getName() : "System");
        log.setRole(currentUser != null && !currentUser.getRoles().isEmpty()
                ? currentUser.getRoles().iterator().next().getName() : null);
        log.setActionTime(LocalDateTime.now());
        activityLogRepository.save(log);
    }
}
