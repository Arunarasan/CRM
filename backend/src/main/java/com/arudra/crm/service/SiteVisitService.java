package com.arudra.crm.service;

import com.arudra.crm.annotation.LogActivity;
import com.arudra.crm.dto.sitevisit.*;
import com.arudra.crm.entity.*;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.*;
import com.arudra.crm.util.SiteVisitWorkflow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class SiteVisitService {

    @Autowired private SiteVisitRepository siteVisitRepository;
    @Autowired private SiteVisitAssignmentRepository assignmentRepository;
    @Autowired private SiteRoomRepository roomRepository;
    @Autowired private SiteMeasurementRepository measurementRepository;
    @Autowired private SiteVisitChecklistRepository checklistRepository;
    @Autowired private SiteVisitMediaRepository mediaRepository;
    @Autowired private SiteVisitHistoryRepository historyRepository;
    @Autowired private LeadRepository leadRepository;
    @Autowired private NotificationService notificationService;

    // =====================================================================
    // List / search / dashboard
    // =====================================================================

    public Page<SiteVisit> getSiteVisits(String status, String visitType, String priority, Long projectId,
                                          Long customerId, Long employeeId, LocalDateTime startDate,
                                          LocalDateTime endDate, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("scheduledTime").descending());
        Specification<SiteVisit> spec = Specification.where(SiteVisitSpecification.notDeleted());
        if (status != null && !status.isEmpty()) spec = spec.and(SiteVisitSpecification.hasStatus(status));
        if (visitType != null && !visitType.isEmpty()) spec = spec.and(SiteVisitSpecification.hasVisitType(visitType));
        if (priority != null && !priority.isEmpty()) spec = spec.and(SiteVisitSpecification.hasPriority(priority));
        if (projectId != null) spec = spec.and(SiteVisitSpecification.hasProject(projectId));
        if (customerId != null) spec = spec.and(SiteVisitSpecification.hasCustomer(customerId));
        if (employeeId != null) spec = spec.and(SiteVisitSpecification.assignedToEmployee(employeeId));
        if (startDate != null && endDate != null) spec = spec.and(SiteVisitSpecification.isBetweenDates(startDate, endDate));
        return siteVisitRepository.findAll(spec, pageRequest);
    }

    public List<SiteVisit> getAllSiteVisits(String status, LocalDateTime startDate, LocalDateTime endDate) {
        Specification<SiteVisit> spec = Specification.where(SiteVisitSpecification.notDeleted());
        if (status != null && !status.isEmpty()) spec = spec.and(SiteVisitSpecification.hasStatus(status));
        if (startDate != null && endDate != null) spec = spec.and(SiteVisitSpecification.isBetweenDates(startDate, endDate));
        return siteVisitRepository.findAll(spec, Sort.by("scheduledTime").ascending());
    }

    public Page<SiteVisit> searchVisits(String query, int page, int size) {
        return siteVisitRepository.searchVisits(query, PageRequest.of(page, size, Sort.by("scheduledTime").descending()));
    }

    public List<SiteVisit> getTodaysVisits() {
        LocalDate today = LocalDate.now();
        Specification<SiteVisit> spec = Specification.where(SiteVisitSpecification.notDeleted())
                .and(SiteVisitSpecification.scheduledDateBetween(today, today));
        return siteVisitRepository.findAll(spec, Sort.by("scheduledTime").ascending());
    }

    public SiteVisitDashboardDTO getDashboard() {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        long todays = siteVisitRepository.countByIsDeletedFalseAndScheduledDate(today);
        long upcoming = siteVisitRepository.countByIsDeletedFalseAndScheduledDateAfter(today);
        long completed = siteVisitRepository.countByIsDeletedFalseAndStatus("Completed");
        long cancelled = siteVisitRepository.countByIsDeletedFalseAndStatus("Cancelled");
        long overdue = siteVisitRepository.countByIsDeletedFalseAndStatusAndScheduledDateBefore("Scheduled", today);
        long thisMonth = siteVisitRepository.countByIsDeletedFalseAndScheduledDateBetween(monthStart, today);
        Double avgDuration = siteVisitRepository.averageVisitDurationMinutes();
        List<Object[]> topEmployees = siteVisitRepository.mostActiveEmployees(monthStart, today);
        String mostActive = topEmployees.isEmpty() ? null : (String) topEmployees.get(0)[1];
        return new SiteVisitDashboardDTO(todays, upcoming, completed, cancelled, overdue,
                avgDuration != null ? avgDuration : 0.0, mostActive, thisMonth);
    }

    public Object getMeta() {
        java.util.Map<String, Object> meta = new java.util.LinkedHashMap<>();
        meta.put("visitTypes", SiteVisitWorkflow.VISIT_TYPES);
        meta.put("statuses", SiteVisitWorkflow.STATUSES);
        meta.put("priorities", SiteVisitWorkflow.PRIORITIES);
        meta.put("outcomes", SiteVisitWorkflow.OUTCOMES);
        meta.put("assignmentRoles", SiteVisitWorkflow.ASSIGNMENT_ROLES);
        meta.put("mediaCategories", SiteVisitWorkflow.MEDIA_CATEGORIES);
        meta.put("checklistItems", SiteVisitWorkflow.DEFAULT_CHECKLIST_ITEMS);
        return meta;
    }

    // =====================================================================
    // CRUD
    // =====================================================================

    public SiteVisit getSiteVisitById(Long id) {
        SiteVisit visit = siteVisitRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Site Visit not found: " + id));
        if (Boolean.TRUE.equals(visit.getIsDeleted())) {
            throw new ResourceNotFoundException("Site Visit not found: " + id);
        }
        return visit;
    }

    @Transactional
    @LogActivity(module = "SiteVisit", action = "CREATE")
    public SiteVisit createSiteVisit(SiteVisit siteVisit, User performedBy) {
        if (siteVisit.getStatus() == null || siteVisit.getStatus().isBlank()) siteVisit.setStatus("Scheduled");
        if (siteVisit.getPriority() == null || siteVisit.getPriority().isBlank()) siteVisit.setPriority("Medium");
        if (siteVisit.getVisitNumber() == null || siteVisit.getVisitNumber().isBlank()) {
            siteVisit.setVisitNumber(nextVisitNumber());
        }
        // The calendar/list views filter by scheduledTime; default it from scheduledDate
        // so date-only visit creation (no time picked) still shows up there.
        if (siteVisit.getScheduledTime() == null && siteVisit.getScheduledDate() != null) {
            siteVisit.setScheduledTime(siteVisit.getScheduledDate().atStartOfDay());
        }
        inheritFromLead(siteVisit);
        SiteVisit saved = siteVisitRepository.save(siteVisit);
        seedChecklist(saved);
        logHistory(saved, "Scheduled", performedBy, "Site Visit " + saved.getVisitNumber() + " scheduled");
        return saved;
    }

    /**
     * Copies the lead's contact and address onto the visit so whoever attends has them, and so the
     * details keep flowing down the Lead → Site Visit → Measurement → BOQ chain. Only fills blanks —
     * anything typed on the visit form wins. The customer link is picked up too, but only exists once
     * the lead has actually been converted; until then downstream documents ride on lead_id.
     */
    private void inheritFromLead(SiteVisit siteVisit) {
        if (siteVisit.getLead() == null || siteVisit.getLead().getId() == null) {
            return;
        }
        Lead lead = leadRepository.findById(siteVisit.getLead().getId()).orElse(null);
        if (lead == null) {
            return;
        }
        siteVisit.setLead(lead);
        if (siteVisit.getCustomer() == null && lead.getConvertedToCustomer() != null) {
            siteVisit.setCustomer(lead.getConvertedToCustomer());
        }
        if (isBlank(siteVisit.getCustomerContactPerson())) {
            siteVisit.setCustomerContactPerson(lead.getName());
        }
        if (isBlank(siteVisit.getCustomerMobile())) {
            siteVisit.setCustomerMobile(lead.getMobileNumber());
        }
        if (isBlank(siteVisit.getLocationAddress())) {
            siteVisit.setLocationAddress(lead.getAddress());
        }
        if (isBlank(siteVisit.getPropertyType())) {
            siteVisit.setPropertyType(lead.getPropertyType());
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /** Generates sequential numbers in the SV-000001 format, mirroring LeadService.nextLeadNumber. */
    private synchronized String nextVisitNumber() {
        List<String> latest = siteVisitRepository.findLatestVisitNumbers(PageRequest.of(0, 1));
        long next = 1;
        if (!latest.isEmpty()) {
            try {
                next = Long.parseLong(latest.get(0).substring("SV-".length())) + 1;
            } catch (NumberFormatException e) {
                return "SV-" + System.currentTimeMillis();
            }
        }
        return String.format("SV-%06d", next);
    }

    private void seedChecklist(SiteVisit visit) {
        for (String item : SiteVisitWorkflow.DEFAULT_CHECKLIST_ITEMS) {
            SiteVisitChecklist checklist = new SiteVisitChecklist();
            checklist.setSiteVisit(visit);
            checklist.setItem(item);
            checklist.setIsCompleted(false);
            checklistRepository.save(checklist);
        }
    }

    @Transactional
    @LogActivity(module = "SiteVisit", action = "UPDATE")
    public SiteVisit updateSiteVisit(Long id, SiteVisit visitDetails, User performedBy) {
        SiteVisit visit = getSiteVisitById(id);
        visit.setVisitType(visitDetails.getVisitType());
        visit.setPriority(visitDetails.getPriority());
        visit.setVisitNotes(visitDetails.getVisitNotes());
        visit.setInternalNotes(visitDetails.getInternalNotes());
        visit.setCustomerNotes(visitDetails.getCustomerNotes());
        visit.setScheduledDate(visitDetails.getScheduledDate());
        visit.setScheduledTime(visitDetails.getScheduledTime());
        visit.setExpectedDuration(visitDetails.getExpectedDuration());
        visit.setActualStartTime(visitDetails.getActualStartTime());
        visit.setActualEndTime(visitDetails.getActualEndTime());
        visit.setLocationAddress(visitDetails.getLocationAddress());
        visit.setMapLocation(visitDetails.getMapLocation());
        visit.setGoogleMapsLink(visitDetails.getGoogleMapsLink());
        visit.setLatitude(visitDetails.getLatitude());
        visit.setLongitude(visitDetails.getLongitude());
        visit.setCustomerContactPerson(visitDetails.getCustomerContactPerson());
        visit.setCustomerMobile(visitDetails.getCustomerMobile());

        // Property Details
        visit.setPropertyType(visitDetails.getPropertyType());
        visit.setTotalFloors(visitDetails.getTotalFloors());
        visit.setAreaSqft(visitDetails.getAreaSqft());
        visit.setConstructionStage(visitDetails.getConstructionStage());
        visit.setSiteCondition(visitDetails.getSiteCondition());
        visit.setAccessibility(visitDetails.getAccessibility());
        visit.setParkingAvailability(visitDetails.getParkingAvailability());
        visit.setPowerAvailability(visitDetails.getPowerAvailability());
        visit.setWaterAvailability(visitDetails.getWaterAvailability());

        // Requirements
        visit.setPreferredStyle(visitDetails.getPreferredStyle());
        visit.setBudget(visitDetails.getBudget());
        visit.setPreferredMaterials(visitDetails.getPreferredMaterials());
        visit.setPreferredColors(visitDetails.getPreferredColors());
        visit.setCompletionTimeline(visitDetails.getCompletionTimeline());
        visit.setSpecialInstructions(visitDetails.getSpecialInstructions());

        // Observations
        visit.setStructuralIssues(visitDetails.getStructuralIssues());
        visit.setElectricalIssues(visitDetails.getElectricalIssues());
        visit.setPlumbingIssues(visitDetails.getPlumbingIssues());
        visit.setPaintingCondition(visitDetails.getPaintingCondition());
        visit.setFloorCondition(visitDetails.getFloorCondition());
        visit.setFurnitureCondition(visitDetails.getFurnitureCondition());
        visit.setSafetyConcerns(visitDetails.getSafetyConcerns());
        visit.setRecommendations(visitDetails.getRecommendations());

        // Contact/location
        visit.setCustomerContactPerson(visitDetails.getCustomerContactPerson());
        visit.setCustomerMobile(visitDetails.getCustomerMobile());
        visit.setGoogleMapsLink(visitDetails.getGoogleMapsLink());
        visit.setLatitude(visitDetails.getLatitude());
        visit.setLongitude(visitDetails.getLongitude());

        // Outcome & follow-up
        visit.setOutcome(visitDetails.getOutcome());
        visit.setNextActionNotes(visitDetails.getNextActionNotes());
        visit.setNextVisitRequired(visitDetails.getNextVisitRequired());
        visit.setNextVisitDate(visitDetails.getNextVisitDate());
        visit.setNextVisitTime(visitDetails.getNextVisitTime());
        visit.setNextVisitPurpose(visitDetails.getNextVisitPurpose());
        visit.setReminderEnabled(visitDetails.getReminderEnabled());

        SiteVisit saved = siteVisitRepository.save(visit);
        logHistory(saved, "Updated", performedBy, "Visit details updated");
        return saved;
    }

    @Transactional
    @LogActivity(module = "SiteVisit", action = "DELETE")
    public void deleteSiteVisit(Long id, User performedBy) {
        SiteVisit visit = getSiteVisitById(id);
        visit.setIsDeleted(true);
        visit.setDeletedAt(LocalDateTime.now());
        visit.setDeletedBy(performedBy != null ? performedBy.getEmail() : null);
        siteVisitRepository.save(visit);
    }

    // =====================================================================
    // Status transitions
    // =====================================================================

    @Transactional
    @LogActivity(module = "SiteVisit", action = "START")
    public SiteVisit startVisit(Long id, User performedBy) {
        SiteVisit visit = getSiteVisitById(id);
        visit.setStatus("In Progress");
        visit.setActualStartTime(LocalDateTime.now());
        SiteVisit saved = siteVisitRepository.save(visit);
        logHistory(saved, "Visit Started", performedBy, "Visit started");
        return saved;
    }

    @Transactional
    @LogActivity(module = "SiteVisit", action = "COMPLETE")
    public SiteVisit completeVisit(Long id, String outcome, String nextActionNotes, User performedBy) {
        SiteVisit visit = getSiteVisitById(id);
        visit.setStatus("Completed");
        visit.setActualEndTime(LocalDateTime.now());
        if (outcome != null) visit.setOutcome(outcome);
        if (nextActionNotes != null) visit.setNextActionNotes(nextActionNotes);
        SiteVisit saved = siteVisitRepository.save(visit);
        logHistory(saved, "Visit Completed", performedBy, "Visit completed. Outcome: " + outcome);
        notifyOwners(saved, performedBy, "Visit Completed",
                saved.getVisitNumber() + " was marked completed" + (outcome != null ? " (" + outcome + ")" : ""));
        return saved;
    }

    @Transactional
    @LogActivity(module = "SiteVisit", action = "CANCEL")
    public SiteVisit cancelVisit(Long id, String reason, User performedBy) {
        SiteVisit visit = getSiteVisitById(id);
        visit.setStatus("Cancelled");
        visit.setVisitNotes(appendNote(visit.getVisitNotes(), "Cancellation Reason: " + reason));
        SiteVisit saved = siteVisitRepository.save(visit);
        logHistory(saved, "Cancelled", performedBy, "Visit cancelled. Reason: " + reason);
        notifyOwners(saved, performedBy, "Visit Cancelled", saved.getVisitNumber() + " was cancelled: " + reason);
        return saved;
    }

    @Transactional
    @LogActivity(module = "SiteVisit", action = "RESCHEDULE")
    public SiteVisit rescheduleVisit(Long id, LocalDateTime newTime, String reason, User performedBy) {
        SiteVisit visit = getSiteVisitById(id);
        visit.setScheduledTime(newTime);
        visit.setScheduledDate(newTime.toLocalDate());
        visit.setStatus("Rescheduled");
        visit.setVisitNotes(appendNote(visit.getVisitNotes(), "Reschedule Reason: " + reason));
        SiteVisit saved = siteVisitRepository.save(visit);
        logHistory(saved, "Rescheduled", performedBy, "Rescheduled to " + newTime + ". Reason: " + reason);
        notifyOwners(saved, performedBy, "Visit Rescheduled",
                saved.getVisitNumber() + " was rescheduled to " + newTime);
        return saved;
    }

    private String appendNote(String existing, String note) {
        return existing == null || existing.isBlank() ? note : existing + "\n" + note;
    }

    // =====================================================================
    // Follow-up
    // =====================================================================

    @Transactional
    public SiteVisit scheduleFollowUp(Long id, User performedBy) {
        SiteVisit visit = getSiteVisitById(id);
        if (!Boolean.TRUE.equals(visit.getNextVisitRequired())) {
            throw new IllegalStateException("Next visit is not marked as required for this visit");
        }
        SiteVisit followUp = new SiteVisit();
        followUp.setLead(visit.getLead());
        followUp.setCustomer(visit.getCustomer());
        followUp.setProject(visit.getProject());
        followUp.setVisitType(visit.getNextVisitPurpose() != null ? visit.getNextVisitPurpose() : "Follow-up");
        followUp.setPriority(visit.getPriority());
        followUp.setScheduledDate(visit.getNextVisitDate());
        followUp.setScheduledTime(visit.getNextVisitTime());
        followUp.setLocationAddress(visit.getLocationAddress());
        followUp.setCustomerContactPerson(visit.getCustomerContactPerson());
        followUp.setCustomerMobile(visit.getCustomerMobile());
        followUp.setFollowUpFrom(visit);
        followUp.setStatus("Scheduled");
        SiteVisit saved = createSiteVisit(followUp, performedBy);

        if (visit.getNextVisitAssignedTo() != null) {
            assignUser(saved.getId(), visit.getNextVisitAssignedTo(), performedBy, "Sales Executive", "Auto-assigned from follow-up");
        }
        logHistory(visit, "Follow-up Scheduled", performedBy, "Follow-up visit " + saved.getVisitNumber() + " created");
        return saved;
    }

    // =====================================================================
    // Assignments
    // =====================================================================

    @Transactional
    @LogActivity(module = "SiteVisit", action = "ASSIGN")
    public SiteVisitAssignment assignUser(Long visitId, User assignee, User assignedBy, String role, String remarks) {
        SiteVisit visit = getSiteVisitById(visitId);
        SiteVisitAssignment assignment = new SiteVisitAssignment();
        assignment.setSiteVisit(visit);
        assignment.setAssignedUser(assignee);
        assignment.setAssignedBy(assignedBy);
        assignment.setRole(role);
        assignment.setRemarks(remarks);
        assignment.setStatus("Assigned");
        assignment.setAssignedDate(LocalDateTime.now());
        SiteVisitAssignment saved = assignmentRepository.save(assignment);

        if (!"Assigned".equals(visit.getStatus()) && "Scheduled".equals(visit.getStatus())) {
            visit.setStatus("Assigned");
            siteVisitRepository.save(visit);
        }
        logHistory(visit, "Employee Assigned", assignedBy, "Assigned " + role + ": " + assignee.getName());
        notificationService.dispatch("Visit Assigned",
                "You have been assigned as " + role + " for visit " + visit.getVisitNumber(),
                "SITE_VISIT", assignee.getId(), "/site-visits/" + visit.getId());
        return saved;
    }

    public List<SiteVisitAssignment> getAssignments(Long visitId) {
        return assignmentRepository.findBySiteVisitId(visitId);
    }

    @Transactional
    public void removeAssignment(Long visitId, Long assignmentId, User performedBy) {
        SiteVisitAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found: " + assignmentId));
        if (!assignment.getSiteVisit().getId().equals(visitId)) {
            throw new ResourceNotFoundException("Assignment does not belong to visit " + visitId);
        }
        assignmentRepository.delete(assignment);
        logHistory(assignment.getSiteVisit(), "Employee Removed", performedBy,
                "Removed " + (assignment.getAssignedUser() != null ? assignment.getAssignedUser().getName() : "employee"));
    }

    @Transactional
    public SiteVisitAssignment acceptAssignment(Long visitId, Long assignmentId, User performedBy) {
        SiteVisitAssignment assignment = getAssignmentOrThrow(visitId, assignmentId);
        assignment.setStatus("Accepted");
        assignment.setAcceptedTime(LocalDateTime.now());
        SiteVisitAssignment saved = assignmentRepository.save(assignment);
        SiteVisit visit = assignment.getSiteVisit();
        if ("Assigned".equals(visit.getStatus()) || "Scheduled".equals(visit.getStatus())) {
            visit.setStatus("Accepted");
            siteVisitRepository.save(visit);
        }
        logHistory(visit, "Employee Accepted", performedBy,
                (assignment.getAssignedUser() != null ? assignment.getAssignedUser().getName() : "Employee") + " accepted the assignment");
        notifyOwners(visit, performedBy, "Employee Accepted",
                (performedBy != null ? performedBy.getName() : "An employee") + " accepted visit " + visit.getVisitNumber());
        return saved;
    }

    @Transactional
    public SiteVisitAssignment markArrival(Long visitId, Long assignmentId, User performedBy) {
        SiteVisitAssignment assignment = getAssignmentOrThrow(visitId, assignmentId);
        assignment.setArrivalTime(LocalDateTime.now());
        SiteVisitAssignment saved = assignmentRepository.save(assignment);
        logHistory(assignment.getSiteVisit(), "Employee Arrived", performedBy,
                (assignment.getAssignedUser() != null ? assignment.getAssignedUser().getName() : "Employee") + " arrived at site");
        return saved;
    }

    @Transactional
    public SiteVisitAssignment completeAssignment(Long visitId, Long assignmentId, User performedBy) {
        SiteVisitAssignment assignment = getAssignmentOrThrow(visitId, assignmentId);
        assignment.setCompletedTime(LocalDateTime.now());
        SiteVisitAssignment saved = assignmentRepository.save(assignment);
        logHistory(assignment.getSiteVisit(), "Employee Completed", performedBy,
                (assignment.getAssignedUser() != null ? assignment.getAssignedUser().getName() : "Employee") + " completed their part");
        return saved;
    }

    private SiteVisitAssignment getAssignmentOrThrow(Long visitId, Long assignmentId) {
        SiteVisitAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found: " + assignmentId));
        if (!assignment.getSiteVisit().getId().equals(visitId)) {
            throw new ResourceNotFoundException("Assignment does not belong to visit " + visitId);
        }
        return assignment;
    }

    /** Notify assigned employees and the visit's creator, excluding whoever performed the action. */
    private void notifyOwners(SiteVisit visit, User actor, String title, String message) {
        java.util.Set<Long> recipients = new java.util.LinkedHashSet<>();
        for (SiteVisitAssignment a : assignmentRepository.findBySiteVisitId(visit.getId())) {
            if (a.getAssignedUser() != null) recipients.add(a.getAssignedUser().getId());
        }
        if (actor != null) recipients.remove(actor.getId());
        for (Long recipientId : recipients) {
            notificationService.dispatch(title, message, "SITE_VISIT", recipientId, "/site-visits/" + visit.getId());
        }
    }

    // =====================================================================
    // Rooms / measurements (unchanged sub-resource behavior)
    // =====================================================================

    @Transactional
    public SiteRoom addRoom(Long visitId, String roomName) {
        SiteRoom room = new SiteRoom();
        room.setSiteVisit(getSiteVisitById(visitId));
        room.setRoomName(roomName);
        return roomRepository.save(room);
    }

    public List<SiteRoom> getRooms(Long visitId) {
        return roomRepository.findBySiteVisitId(visitId);
    }

    /** A room holds one set of on-site dimensions, so re-saving edits the existing row instead of stacking rows. */
    @Transactional
    public SiteMeasurement addMeasurement(Long roomId, SiteMeasurement measurement, User performedBy) {
        SiteRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Site Room not found: " + roomId));

        List<SiteMeasurement> existing = measurementRepository.findBySiteRoomId(roomId);
        SiteMeasurement target = existing.isEmpty() ? new SiteMeasurement() : existing.get(0);
        boolean isUpdate = !existing.isEmpty();

        target.setSiteRoom(room);
        target.setLength(measurement.getLength());
        target.setWidth(measurement.getWidth());
        target.setHeight(measurement.getHeight());
        target.setCeilingHeight(measurement.getCeilingHeight());
        target.setDoors(measurement.getDoors());
        target.setWindows(measurement.getWindows());
        target.setFloorType(measurement.getFloorType());
        target.setWallFinish(measurement.getWallFinish());
        target.setNotes(measurement.getNotes());
        target.setArea(computeArea(measurement.getLength(), measurement.getWidth()));

        SiteMeasurement saved = measurementRepository.save(target);
        logHistory(room.getSiteVisit(), "Measurements Completed", performedBy,
                (isUpdate ? "Updated" : "Added") + " measurements for " + room.getRoomName());
        return saved;
    }

    private Double computeArea(Double length, Double width) {
        return (length == null || width == null) ? null : length * width;
    }

    public List<SiteMeasurement> getMeasurements(Long roomId) {
        return measurementRepository.findBySiteRoomId(roomId);
    }

    // =====================================================================
    // Media
    // =====================================================================

    @Transactional
    public SiteVisitMedia addMedia(Long visitId, SiteVisitMedia media, User performedBy) {
        SiteVisit visit = getSiteVisitById(visitId);
        media.setSiteVisit(visit);
        media.setUploadTime(LocalDateTime.now());
        media.setUploadedBy(performedBy);
        SiteVisitMedia saved = mediaRepository.save(media);
        logHistory(visit, "Photos Uploaded", performedBy, "Uploaded " + media.getMediaType()
                + (media.getCategory() != null ? " (" + media.getCategory() + ")" : ""));
        return saved;
    }

    public List<SiteVisitMedia> getMedia(Long visitId) {
        return mediaRepository.findBySiteVisitId(visitId);
    }

    // =====================================================================
    // Checklist
    // =====================================================================

    public List<SiteVisitChecklist> getChecklist(Long visitId) {
        return checklistRepository.findBySiteVisitId(visitId);
    }

    @Transactional
    public SiteVisitChecklist updateChecklistItem(Long visitId, Long checklistId, boolean completed, String remarks, User performedBy) {
        SiteVisitChecklist item = checklistRepository.findById(checklistId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found: " + checklistId));
        if (!item.getSiteVisit().getId().equals(visitId)) {
            throw new ResourceNotFoundException("Checklist item does not belong to visit " + visitId);
        }
        item.setIsCompleted(completed);
        if (remarks != null) item.setRemarks(remarks);
        SiteVisitChecklist saved = checklistRepository.save(item);
        if (completed) {
            logHistory(item.getSiteVisit(), "Checklist Updated", performedBy, item.getItem() + " marked complete");
        }
        return saved;
    }

    // =====================================================================
    // Signature
    // =====================================================================

    @Transactional
    public SiteVisit updateSignature(Long id, String base64Signature, String customerName, User performedBy) {
        SiteVisit visit = getSiteVisitById(id);
        visit.setSignatureBase64(base64Signature);
        visit.setSignedByCustomer(customerName);
        visit.setSignatureDate(LocalDateTime.now());
        visit.setStatus("Completed");
        SiteVisit saved = siteVisitRepository.save(visit);
        logHistory(saved, "Customer Signed", performedBy, "Customer Signature Captured");
        return saved;
    }

    // =====================================================================
    // History
    // =====================================================================

    public List<SiteVisitHistory> getHistory(Long visitId) {
        return historyRepository.findBySiteVisitIdOrderByActionTimestampDesc(visitId);
    }

    private void logHistory(SiteVisit visit, String action, User user, String remarks) {
        SiteVisitHistory history = new SiteVisitHistory();
        history.setSiteVisit(visit);
        history.setAction(action);
        history.setActionTimestamp(LocalDateTime.now());
        history.setPerformedBy(user);
        history.setRemarks(remarks);
        historyRepository.save(history);
    }
}
