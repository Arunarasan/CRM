package com.arudra.crm.service;

import com.arudra.crm.dto.lead.*;
import com.arudra.crm.entity.*;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.*;
import com.arudra.crm.util.LeadWorkflow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class LeadService {

    private static final Set<String> SORTABLE_FIELDS = Set.of(
            "id", "leadNumber", "name", "status", "stage", "priority", "leadTemperature",
            "estimatedBudget", "nextFollowUpDate", "lastContactAt", "createdAt", "city");

    /** Pipeline board columns → the statuses they aggregate. */
    private static final Map<String, List<String>> BOARD_COLUMNS = new LinkedHashMap<>();

    static {
        BOARD_COLUMNS.put("New", List.of("New"));
        BOARD_COLUMNS.put("Contacted", List.of("Contacted", "Follow-up"));
        BOARD_COLUMNS.put("Interested", List.of("Interested"));
        BOARD_COLUMNS.put("Site Visit", List.of("Site Visit Scheduled", "Site Visit Completed"));
        BOARD_COLUMNS.put("Measurement", List.of("Measurement Scheduled", "Measurement Completed"));
        BOARD_COLUMNS.put("Quotation", List.of("Quotation Preparing", "Quotation Sent",
                "Quotation Revised", "Quotation Approved", "Quotation Rejected"));
        BOARD_COLUMNS.put("Negotiation", List.of("Negotiation"));
        BOARD_COLUMNS.put("Won", List.of("Project Confirmed", "Project Started", "Completed"));
        BOARD_COLUMNS.put("On Hold", List.of("On Hold"));
        BOARD_COLUMNS.put("Lost", List.of("Lost", "Cancelled"));
    }

    /** Probability weights per open status for the revenue forecast. */
    private static final Map<String, Double> FORECAST_WEIGHTS = Map.ofEntries(
            Map.entry("New", 0.05), Map.entry("Contacted", 0.10), Map.entry("Follow-up", 0.15),
            Map.entry("Interested", 0.25), Map.entry("Site Visit Scheduled", 0.30),
            Map.entry("Site Visit Completed", 0.35), Map.entry("Measurement Scheduled", 0.40),
            Map.entry("Measurement Completed", 0.45), Map.entry("Quotation Preparing", 0.50),
            Map.entry("Quotation Sent", 0.55), Map.entry("Quotation Revised", 0.60),
            Map.entry("Quotation Rejected", 0.20), Map.entry("Negotiation", 0.70),
            Map.entry("Quotation Approved", 0.85), Map.entry("On Hold", 0.10));

    @Autowired private LeadRepository leadRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private LeadActivityRepository leadActivityRepository;
    @Autowired private LeadAssignmentRepository leadAssignmentRepository;
    @Autowired private LeadFollowupRepository leadFollowupRepository;
    @Autowired private LeadStatusHistoryRepository leadStatusHistoryRepository;
    @Autowired private LeadCommunicationRepository leadCommunicationRepository;
    @Autowired private LeadNoteRepository leadNoteRepository;
    @Autowired private LeadDocumentRepository leadDocumentRepository;
    @Autowired private LeadReminderRepository leadReminderRepository;
    @Autowired private SiteVisitRepository siteVisitRepository;
    @Autowired private SiteVisitService siteVisitService;
    @Autowired private MeasurementRepository measurementRepository;
    @Autowired private QuotationRepository quotationRepository;
    @Autowired private BoqRepository boqRepository;
    @Autowired private NotificationService notificationService;

    // =====================================================================
    // Query / list
    // =====================================================================

    public Page<Lead> getLeads(String search, String status, String stage, String source,
            String leadType, String priority, String temperature, String city,
            Long assignedEmployeeId, Boolean isConverted,
            BigDecimal budgetMin, BigDecimal budgetMax,
            LocalDate dateFrom, LocalDate dateTo,
            String sortBy, String sortDir, int page, int size) {

        String sortField = (sortBy != null && SORTABLE_FIELDS.contains(sortBy)) ? sortBy : "id";
        Sort sort = "asc".equalsIgnoreCase(sortDir) ? Sort.by(sortField).ascending()
                : Sort.by(sortField).descending();
        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 200), sort);

        Specification<Lead> spec = Specification.where(LeadSpecification.notDeleted())
                .and(LeadSpecification.isConverted(isConverted))
                .and(LeadSpecification.hasStatus(status))
                .and(LeadSpecification.hasStage(stage))
                .and(LeadSpecification.hasSource(source))
                .and(LeadSpecification.hasType(leadType))
                .and(LeadSpecification.hasPriority(priority))
                .and(LeadSpecification.hasTemperature(temperature))
                .and(LeadSpecification.hasCity(city))
                .and(LeadSpecification.hasAssignedEmployee(assignedEmployeeId))
                .and(LeadSpecification.budgetBetween(budgetMin, budgetMax))
                .and(LeadSpecification.createdBetween(dateFrom, dateTo))
                .and(LeadSpecification.matchesSearch(search));

        return leadRepository.findAll(spec, pageRequest);
    }

    public Lead getLeadById(Long id) {
        Lead lead = leadRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lead not found with id: " + id));
        if (Boolean.TRUE.equals(lead.getIsDeleted())) {
            throw new ResourceNotFoundException("Lead not found with id: " + id);
        }
        return lead;
    }

    // =====================================================================
    // Kanban board
    // =====================================================================

    public List<LeadBoardColumnDTO> getBoard(Long assignedEmployeeId) {
        Specification<Lead> spec = Specification.where(LeadSpecification.notDeleted())
                .and(LeadSpecification.hasAssignedEmployee(assignedEmployeeId));
        List<Lead> leads = leadRepository.findAll(spec,
                PageRequest.of(0, 500, Sort.by("id").descending())).getContent();

        Map<String, LeadBoardColumnDTO> columns = new LinkedHashMap<>();
        Map<String, String> statusToColumn = new HashMap<>();
        BOARD_COLUMNS.forEach((column, statuses) -> {
            LeadBoardColumnDTO dto = new LeadBoardColumnDTO();
            dto.setKey(column);
            columns.put(column, dto);
            statuses.forEach(s -> statusToColumn.put(s, column));
        });

        for (Lead lead : leads) {
            String column = statusToColumn.getOrDefault(lead.getStatus(), "New");
            LeadBoardColumnDTO dto = columns.get(column);
            dto.getLeads().add(LeadCardDTO.from(lead));
            dto.setCount(dto.getCount() + 1);
            if (lead.getEstimatedBudget() != null) {
                dto.setTotalValue(dto.getTotalValue().add(lead.getEstimatedBudget()));
            }
        }
        return new ArrayList<>(columns.values());
    }

    // =====================================================================
    // Dashboard
    // =====================================================================

    public LeadDashboardDTO getDashboard() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfToday = today.atStartOfDay();
        LocalDateTime startOfWeek = today.with(DayOfWeek.MONDAY).atStartOfDay();
        LocalDateTime startOfMonth = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime now = LocalDateTime.now();

        LeadDashboardDTO dto = new LeadDashboardDTO();
        dto.setTotalLeads(leadRepository.countByIsDeletedFalse());
        dto.setTodayLeads(leadRepository.countByIsDeletedFalseAndCreatedAtBetween(startOfToday, now));
        dto.setWeekLeads(leadRepository.countByIsDeletedFalseAndCreatedAtBetween(startOfWeek, now));
        dto.setMonthLeads(leadRepository.countByIsDeletedFalseAndCreatedAtBetween(startOfMonth, now));
        dto.setHotLeads(leadRepository.countByIsDeletedFalseAndLeadTemperatureIgnoreCaseAndIsConvertedFalse("Hot"));
        dto.setWarmLeads(leadRepository.countByIsDeletedFalseAndLeadTemperatureIgnoreCaseAndIsConvertedFalse("Warm"));
        dto.setColdLeads(leadRepository.countByIsDeletedFalseAndLeadTemperatureIgnoreCaseAndIsConvertedFalse("Cold"));
        dto.setConvertedLeads(leadRepository.countByIsDeletedFalseAndIsConvertedTrue());
        dto.setLostLeads(leadRepository.countByIsDeletedFalseAndStatusIgnoreCase("Lost"));
        dto.setTodaysFollowups(leadRepository.countByIsDeletedFalseAndNextFollowUpDateAndIsConvertedFalse(today));
        dto.setPendingFollowups(leadRepository
                .countByIsDeletedFalseAndNextFollowUpDateBeforeAndIsConvertedFalseAndStatusNotIn(
                        today, LeadWorkflow.CLOSED_STATUSES));
        dto.setTodaySiteVisits(siteVisitRepository.countByScheduledDateAndLeadIsNotNullAndIsDeletedFalse(today));
        dto.setTodayMeasurements(measurementRepository.countByMeasurementDateAndLeadIsNotNull(today));
        dto.setQuotationPending(leadRepository
                .countByIsDeletedFalseAndStatusIn(LeadWorkflow.QUOTATION_PENDING_STATUSES));

        // legacy keys
        dto.setNewLeads(leadRepository.countByIsDeletedFalseAndStatusIgnoreCase("New"));
        dto.setQualifiedLeads(leadRepository.countByIsDeletedFalseAndStatusIn(
                List.of("Interested", "Negotiation", "Quotation Approved", "Project Confirmed")));
        dto.setWonLeads(dto.getConvertedLeads());
        dto.setConversionRate(formatRate(dto.getConvertedLeads(), dto.getTotalLeads()));
        return dto;
    }

    private String formatRate(long part, long total) {
        if (total == 0) return "0%";
        return BigDecimal.valueOf(part * 100.0 / total).setScale(1, RoundingMode.HALF_UP) + "%";
    }

    // =====================================================================
    // Create / update
    // =====================================================================

    @Transactional
    public Lead createLead(Lead lead, User currentUser) {
        if (lead.getStatus() == null || lead.getStatus().isBlank()) {
            lead.setStatus("New");
        }
        if (lead.getStage() == null || lead.getStage().isBlank()) {
            lead.setStage(LeadWorkflow.stageForStatus(lead.getStatus(), null));
        }
        if (lead.getLeadTemperature() == null || lead.getLeadTemperature().isBlank()) {
            lead.setLeadTemperature("Warm");
        }
        if (lead.getLeadNumber() == null || lead.getLeadNumber().isBlank()) {
            lead.setLeadNumber(nextLeadNumber());
        }

        Lead savedLead = leadRepository.save(lead);
        logActivity(savedLead, "CREATED", "Lead " + savedLead.getLeadNumber() + " created.", currentUser);

        // Surface every new lead to admins (e.g. a field employee submitting one from the portal).
        notificationService.dispatchToAdmins("New Lead",
                savedLead.getName() + " (" + savedLead.getLeadNumber() + ")"
                        + (currentUser != null ? " added by " + currentUser.getName() : ""),
                "LEAD", "/leads/" + savedLead.getId(),
                currentUser != null ? currentUser.getId() : null);

        if (savedLead.getAssignedSalesExecutive() != null) {
            assignLead(savedLead.getId(), savedLead.getAssignedSalesExecutive().getId(),
                    "Sales Executive", currentUser);
        }
        return savedLead;
    }

    /**
     * Generates sequential numbers in the LEAD-000001 format. Falls back to a
     * timestamp suffix if the latest number cannot be parsed (e.g. legacy "L-..."
     * numbers only).
     */
    private synchronized String nextLeadNumber() {
        List<String> latest = leadRepository.findLatestLeadNumbers(PageRequest.of(0, 1));
        long next = 1;
        if (!latest.isEmpty()) {
            try {
                next = Long.parseLong(latest.get(0).substring("LEAD-".length())) + 1;
            } catch (NumberFormatException e) {
                return "LEAD-" + System.currentTimeMillis();
            }
        }
        return String.format("LEAD-%06d", next);
    }

    @Transactional
    public Lead updateLead(Long id, Lead d, User currentUser) {
        Lead lead = getLeadById(id);

        // Basic
        lead.setName(d.getName());
        lead.setLeadType(d.getLeadType());
        lead.setLeadSource(d.getLeadSource());
        lead.setPriority(d.getPriority());
        if (d.getLeadTemperature() != null) lead.setLeadTemperature(d.getLeadTemperature());

        // Customer
        lead.setCompanyName(d.getCompanyName());
        lead.setContactPerson(d.getContactPerson());
        lead.setMobileNumber(d.getMobileNumber());
        lead.setAlternateMobile(d.getAlternateMobile());
        lead.setWhatsappNumber(d.getWhatsappNumber());
        lead.setEmail(d.getEmail());
        lead.setGstNumber(d.getGstNumber());
        lead.setAddress(d.getAddress());
        lead.setCity(d.getCity());
        lead.setDistrict(d.getDistrict());
        lead.setState(d.getState());
        lead.setPincode(d.getPincode());
        lead.setGoogleMapLocation(d.getGoogleMapLocation());

        // Property
        lead.setPropertyType(d.getPropertyType());
        lead.setPropertyName(d.getPropertyName());
        lead.setSiteAddress(d.getSiteAddress());
        lead.setLandmark(d.getLandmark());
        lead.setFloorCount(d.getFloorCount());
        lead.setAreaSqft(d.getAreaSqft());
        lead.setExpectedWorkArea(d.getExpectedWorkArea());
        lead.setCurrentConstructionStage(d.getCurrentConstructionStage());

        // Requirements
        lead.setRequirementCategory(d.getRequirementCategory());
        lead.setProjectDescription(d.getProjectDescription());
        lead.setCustomerRequirements(d.getCustomerRequirements());
        lead.setPreferredDesignStyle(d.getPreferredDesignStyle());
        lead.setPreferredMaterial(d.getPreferredMaterial());
        lead.setPreferredColorTheme(d.getPreferredColorTheme());
        lead.setPreferredCompletionDate(d.getPreferredCompletionDate());
        lead.setEstimatedDuration(d.getEstimatedDuration());

        // Scope of work checklist
        lead.setRoomsRequired(d.getRoomsRequired());
        lead.setReqKitchen(d.getReqKitchen());
        lead.setReqWardrobe(d.getReqWardrobe());
        lead.setReqTvUnit(d.getReqTvUnit());
        lead.setReqFalseCeiling(d.getReqFalseCeiling());
        lead.setReqPainting(d.getReqPainting());
        lead.setReqFlooring(d.getReqFlooring());
        lead.setReqElectrical(d.getReqElectrical());
        lead.setReqPlumbing(d.getReqPlumbing());
        lead.setReqWoodFinish(d.getReqWoodFinish());
        lead.setSpecialRequests(d.getSpecialRequests());

        // Budget
        lead.setEstimatedBudget(d.getEstimatedBudget());
        lead.setMinimumBudget(d.getMinimumBudget());
        lead.setMaximumBudget(d.getMaximumBudget());
        lead.setExpectedProjectValue(d.getExpectedProjectValue());
        lead.setPaymentPreference(d.getPaymentPreference());
        lead.setExpectedStartDate(d.getExpectedStartDate());
        lead.setExpectedEndDate(d.getExpectedEndDate());

        Lead updatedLead = leadRepository.save(lead);
        logActivity(updatedLead, "UPDATED", "Lead details updated.", currentUser);
        return updatedLead;
    }

    // =====================================================================
    // Status / stage / assignment
    // =====================================================================

    @Transactional
    public Lead updateLeadStatus(Long id, String newStatus, String remarks, User user) {
        Lead lead = getLeadById(id);
        String oldStatus = lead.getStatus();

        if (oldStatus.equals(newStatus)) return lead;

        lead.setStatus(newStatus);
        lead.setStage(LeadWorkflow.stageForStatus(newStatus, lead.getStage()));
        Lead updatedLead = leadRepository.save(lead);

        LeadStatusHistory history = new LeadStatusHistory();
        history.setLead(updatedLead);
        history.setOldStatus(oldStatus);
        history.setNewStatus(newStatus);
        history.setRemarks(remarks);
        history.setChangedBy(user);
        history.setChangedAt(LocalDateTime.now());
        leadStatusHistoryRepository.save(history);

        logActivity(updatedLead, "STATUS_CHANGED",
                "Status changed from " + oldStatus + " to " + newStatus, user);
        notifyLeadTeam(updatedLead, user, "Lead status updated",
                updatedLead.getLeadNumber() + " (" + updatedLead.getName() + ") moved from "
                        + oldStatus + " to " + newStatus);
        return updatedLead;
    }

    @Transactional
    public Lead updateLeadStage(Long id, String stage, User user) {
        Lead lead = getLeadById(id);
        String oldStage = lead.getStage();
        lead.setStage(stage);
        Lead saved = leadRepository.save(lead);
        logActivity(saved, "STAGE_CHANGED", "Stage changed from " + oldStage + " to " + stage, user);
        return saved;
    }

    @Transactional
    public Lead assignLead(Long leadId, Long userId, String role, User assignedBy) {
        Lead lead = getLeadById(leadId);
        User userToAssign = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if ("Sales Executive".equals(role)) {
            lead.setAssignedSalesExecutive(userToAssign);
            lead.setAssignedDate(LocalDateTime.now());
            lead.setAssignedBy(assignedBy);
        } else if ("Project Manager".equals(role)) {
            lead.setProjectManager(userToAssign);
        } else if ("Engineer".equals(role)) {
            lead.setAssignedEngineer(userToAssign);
        } else if ("Designer".equals(role)) {
            lead.setAssignedDesigner(userToAssign);
        }

        leadRepository.save(lead);

        LeadAssignment assignment = new LeadAssignment();
        assignment.setLead(lead);
        assignment.setAssignedTo(userToAssign);
        assignment.setAssignedRole(role);
        assignment.setAssignedBy(assignedBy);
        assignment.setAssignedDate(LocalDateTime.now());
        leadAssignmentRepository.save(assignment);

        logActivity(lead, "ASSIGNED", "Assigned " + userToAssign.getName() + " as " + role, assignedBy);
        notificationService.dispatch("Lead assigned to you",
                lead.getLeadNumber() + " (" + lead.getName() + ") was assigned to you as " + role + ".",
                "LEAD", userToAssign.getId(), "/leads/" + lead.getId());
        return lead;
    }

    public List<LeadAssignment> getAssignments(Long leadId) {
        return leadAssignmentRepository.findByLeadIdOrderByAssignedDateDesc(leadId);
    }

    // =====================================================================
    // Follow-ups
    // =====================================================================

    public List<LeadFollowup> getFollowups(Long leadId) {
        return leadFollowupRepository.findByLeadIdOrderByFollowupDateDesc(leadId);
    }

    @Transactional
    public LeadFollowup addFollowup(Long leadId, LeadFollowup followup, User currentUser) {
        Lead lead = getLeadById(leadId);
        followup.setLead(lead);
        followup.setPerformedBy(currentUser);
        if (followup.getStatus() == null) followup.setStatus("Completed");
        LeadFollowup saved = leadFollowupRepository.save(followup);

        lead.setLastFollowUp(LocalDateTime.now());
        lead.setLastContactAt(LocalDateTime.now());
        lead.setNextFollowUpDate(followup.getNextFollowupDate());
        lead.setNextFollowUpTime(followup.getNextFollowupTime());
        lead.setFollowUpCount((lead.getFollowUpCount() == null ? 0 : lead.getFollowUpCount()) + 1);
        lead.setFollowUpOutcome(followup.getOutcome());
        leadRepository.save(lead);

        if (Boolean.TRUE.equals(followup.getReminderEnabled()) && followup.getNextFollowupDate() != null) {
            LeadReminder reminder = new LeadReminder();
            reminder.setLead(lead);
            reminder.setTitle("Follow-up: " + lead.getName());
            reminder.setTaskType("Call Customer");
            reminder.setPriority(followup.getPriority() != null ? followup.getPriority() : "Medium");
            reminder.setReminderTime(followup.getNextFollowupDate().atTime(
                    followup.getNextFollowupTime() != null ? followup.getNextFollowupTime()
                            : java.time.LocalTime.of(9, 0)));
            reminder.setDescription("Scheduled from follow-up log");
            reminder.setAssignedTo(currentUser != null ? currentUser : lead.getAssignedSalesExecutive());
            leadReminderRepository.save(reminder);
        }

        logActivity(lead, "FOLLOW_UP",
                "Follow-up added via " + followup.getMethod() + ". Outcome: " + followup.getOutcome(),
                currentUser);
        return saved;
    }

    // =====================================================================
    // Communications
    // =====================================================================

    public List<LeadCommunication> getCommunications(Long leadId) {
        return leadCommunicationRepository
                .findByLeadIdOrderByCommunicationDateDescCommunicationTimeDesc(leadId);
    }

    @Transactional
    public LeadCommunication addCommunication(Long leadId, LeadCommunication communication, User currentUser) {
        Lead lead = getLeadById(leadId);
        communication.setLead(lead);
        communication.setPerformedBy(currentUser);
        if (communication.getCommunicationDate() == null) {
            communication.setCommunicationDate(LocalDate.now());
        }
        LeadCommunication saved = leadCommunicationRepository.save(communication);

        lead.setLastContactAt(LocalDateTime.now());
        leadRepository.save(lead);

        logActivity(lead, "COMMUNICATION",
                communication.getCommunicationType() + " logged: "
                        + (communication.getSummary() != null ? communication.getSummary() : ""),
                currentUser);
        return saved;
    }

    // =====================================================================
    // Notes
    // =====================================================================

    public List<LeadNote> getNotes(Long leadId) {
        return leadNoteRepository.findByLeadIdOrderByCreatedAtDesc(leadId);
    }

    @Transactional
    public LeadNote addNote(Long leadId, String content, User currentUser) {
        Lead lead = getLeadById(leadId);
        LeadNote note = new LeadNote();
        note.setLead(lead);
        note.setContent(content);
        note.setAuthor(currentUser);
        LeadNote saved = leadNoteRepository.save(note);
        logActivity(lead, "NOTE_ADDED", "Note added.", currentUser);
        return saved;
    }

    @Transactional
    public void deleteNote(Long leadId, Long noteId, User currentUser) {
        LeadNote note = leadNoteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Note not found with id: " + noteId));
        if (!note.getLead().getId().equals(leadId)) {
            throw new ResourceNotFoundException("Note does not belong to lead " + leadId);
        }
        leadNoteRepository.delete(note);
        logActivity(note.getLead(), "NOTE_DELETED", "Note removed.", currentUser);
    }

    // =====================================================================
    // Documents
    // =====================================================================

    public List<LeadDocument> getDocuments(Long leadId) {
        return leadDocumentRepository.findByLeadId(leadId);
    }

    @Transactional
    public LeadDocument addDocument(Long leadId, LeadDocument document, User currentUser) {
        Lead lead = getLeadById(leadId);
        document.setLead(lead);
        document.setUploadedBy(currentUser);
        LeadDocument saved = leadDocumentRepository.save(document);
        logActivity(lead, "DOCUMENT_ADDED",
                "Document uploaded: " + document.getFileName()
                        + (document.getCategory() != null ? " (" + document.getCategory() + ")" : ""),
                currentUser);
        return saved;
    }

    @Transactional
    public void deleteDocument(Long leadId, Long documentId, User currentUser) {
        LeadDocument document = leadDocumentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found with id: " + documentId));
        if (!document.getLead().getId().equals(leadId)) {
            throw new ResourceNotFoundException("Document does not belong to lead " + leadId);
        }
        leadDocumentRepository.delete(document);
        logActivity(document.getLead(), "DOCUMENT_DELETED",
                "Document removed: " + document.getFileName(), currentUser);
    }

    // =====================================================================
    // Tasks (LeadReminder-backed)
    // =====================================================================

    public List<LeadReminder> getTasks(Long leadId) {
        return leadReminderRepository.findByLeadIdOrderByReminderTimeAsc(leadId);
    }

    @Transactional
    public LeadReminder addTask(Long leadId, LeadReminder task, User currentUser) {
        Lead lead = getLeadById(leadId);
        task.setLead(lead);
        if (task.getStatus() == null) task.setStatus("Pending");
        if (task.getAssignedTo() == null) {
            task.setAssignedTo(lead.getAssignedSalesExecutive() != null
                    ? lead.getAssignedSalesExecutive() : currentUser);
        }
        LeadReminder saved = leadReminderRepository.save(task);
        logActivity(lead, "TASK_CREATED",
                "Task created: " + (task.getTitle() != null ? task.getTitle() : task.getTaskType()),
                currentUser);
        if (saved.getAssignedTo() != null
                && (currentUser == null || !saved.getAssignedTo().getId().equals(currentUser.getId()))) {
            notificationService.dispatch("Lead task assigned",
                    "Task \"" + saved.getTitle() + "\" on " + lead.getLeadNumber() + " assigned to you.",
                    "LEAD", saved.getAssignedTo().getId(), "/leads/" + lead.getId());
        }
        return saved;
    }

    @Transactional
    public LeadReminder updateTaskStatus(Long leadId, Long taskId, String status, User currentUser) {
        LeadReminder task = leadReminderRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId));
        if (!task.getLead().getId().equals(leadId)) {
            throw new ResourceNotFoundException("Task does not belong to lead " + leadId);
        }
        task.setStatus(status);
        if ("Completed".equalsIgnoreCase(status)) {
            task.setIsCompleted(true);
            task.setCompletedAt(LocalDateTime.now());
        } else {
            task.setIsCompleted(false);
            task.setCompletedAt(null);
        }
        LeadReminder saved = leadReminderRepository.save(task);
        logActivity(task.getLead(), "TASK_UPDATED",
                "Task \"" + (task.getTitle() != null ? task.getTitle() : task.getTaskType())
                        + "\" marked " + status, currentUser);
        return saved;
    }

    // =====================================================================
    // Linked modules: site visits, measurements, quotations
    // =====================================================================

    public List<SiteVisit> getSiteVisits(Long leadId) {
        return siteVisitRepository.findByLeadIdAndIsDeletedFalseOrderByScheduledDateDesc(leadId);
    }

    @Transactional
    public SiteVisit scheduleSiteVisit(Long leadId, SiteVisit visit, User currentUser) {
        Lead lead = getLeadById(leadId);
        visit.setLead(lead);
        if (lead.getConvertedToCustomer() != null) visit.setCustomer(lead.getConvertedToCustomer());
        if (visit.getLocationAddress() == null) visit.setLocationAddress(lead.getSiteAddress());
        SiteVisit saved = siteVisitService.createSiteVisit(visit, currentUser);

        if (!LeadWorkflow.CLOSED_STATUSES.contains(lead.getStatus())
                && !Boolean.TRUE.equals(lead.getIsConverted())) {
            updateLeadStatus(leadId, "Site Visit Scheduled",
                    "Site visit " + saved.getVisitNumber() + " scheduled", currentUser);
        }
        lead.setSiteVisitRequired(true);
        lead.setSiteVisitDate(visit.getScheduledDate());
        leadRepository.save(lead);

        logActivity(lead, "SITE_VISIT_SCHEDULED",
                "Site visit " + saved.getVisitNumber() + " scheduled for " + visit.getScheduledDate(),
                currentUser);
        if (lead.getAssignedEngineer() != null) {
            notificationService.dispatch("Site visit scheduled",
                    "Site visit for " + lead.getLeadNumber() + " on " + visit.getScheduledDate() + ".",
                    "LEAD", lead.getAssignedEngineer().getId(), "/leads/" + lead.getId());
        }
        return saved;
    }

    public List<Measurement> getMeasurements(Long leadId) {
        return measurementRepository.findByLeadId(leadId);
    }

    public List<Quotation> getQuotations(Long leadId) {
        return quotationRepository.findByLeadIdOrderByCreatedAtDesc(leadId);
    }

    public List<Boq> getBoqs(Long leadId) {
        return boqRepository.findByLeadIdAndIsDeletedFalseOrderByIdDesc(leadId);
    }

    public List<Project> getProjects(Long leadId) {
        return projectRepository.findByLeadIdOrderByIdDesc(leadId);
    }

    // =====================================================================
    // Activity / history
    // =====================================================================

    public List<LeadActivity> getActivities(Long leadId) {
        return leadActivityRepository.findByLeadIdOrderByCreatedAtDesc(leadId);
    }

    public List<LeadStatusHistory> getStatusHistory(Long leadId) {
        return leadStatusHistoryRepository.findByLeadIdOrderByChangedAtDesc(leadId);
    }

    // =====================================================================
    // Lost / delete
    // =====================================================================

    @Transactional
    public Lead markAsLost(Long leadId, String reason, String competitor, String feedback, User currentUser) {
        Lead lead = getLeadById(leadId);
        lead.setLostReason(reason);
        lead.setCompetitor(competitor);
        lead.setCustomerFeedback(feedback);
        lead.setLeadTemperature("Cold");
        leadRepository.save(lead);
        return updateLeadStatus(leadId, "Lost", reason, currentUser);
    }

    /** Soft delete: the lead and its full history remain in the database. */
    @Transactional
    public void deleteLead(Long id, User currentUser) {
        Lead lead = getLeadById(id);
        lead.setIsDeleted(true);
        lead.setDeletedAt(LocalDateTime.now());
        lead.setDeletedBy(currentUser != null ? currentUser.getEmail() : "system");
        leadRepository.save(lead);
        logActivity(lead, "DELETED", "Lead soft-deleted.", currentUser);
    }

    // =====================================================================
    // Conversion
    // =====================================================================

    /** Legacy conversion endpoint behaviour: customer only. */
    @Transactional
    public Customer convertLeadToCustomer(Long leadId, User user) {
        LeadConversionResultDTO result = convertLead(leadId, new LeadConversionRequest(), user);
        return customerRepository.findById(result.getCustomerId()).orElseThrow();
    }

    /**
     * Conversion: creates the customer and re-links every quotation, site visit and measurement of
     * the lead so no history is lost. A Project is never created here — it's only ever created once
     * a Quotation for this lead is approved and converted (see QuotationService.convertToProject),
     * which is also what marks this lead as having a converted project.
     */
    @Transactional
    public LeadConversionResultDTO convertLead(Long leadId, LeadConversionRequest request, User user) {
        Lead lead = getLeadById(leadId);
        if (Boolean.TRUE.equals(lead.getIsConverted())) {
            throw new IllegalStateException("Lead is already converted.");
        }

        // 1. Customer
        Customer customer = new Customer();
        customer.setName(lead.getCompanyName() != null && !lead.getCompanyName().isEmpty()
                ? lead.getCompanyName() : lead.getName());
        customer.setEmail(lead.getEmail());
        customer.setPhone(lead.getMobileNumber());
        customer.setAlternatePhone(lead.getAlternateMobile());
        customer.setWhatsappNumber(lead.getWhatsappNumber());
        customer.setCity(lead.getCity());
        customer.setDistrict(lead.getDistrict());
        customer.setState(lead.getState());
        customer.setPincode(lead.getPincode());
        customer.setBillingAddress(lead.getAddress());
        customer.setSiteAddress(lead.getSiteAddress());
        customer.setGoogleMapLocation(lead.getGoogleMapLocation());
        customer.setGstNumber(lead.getGstNumber());
        customer.setContactPersonName(lead.getContactPerson());
        customer.setCompanyName(lead.getCompanyName());
        customer.setCustomerSince(LocalDate.now());
        customer.setAssignedEmployee(lead.getAssignedSalesExecutive());
        Customer savedCustomer = customerRepository.save(customer);

        // 2. Re-link history so nothing is orphaned
        List<Quotation> quotations = quotationRepository.findByLeadIdOrderByCreatedAtDesc(leadId);
        List<SiteVisit> visits = siteVisitRepository.findByLeadIdAndIsDeletedFalseOrderByScheduledDateDesc(leadId);
        for (SiteVisit visit : visits) {
            if (visit.getCustomer() == null) visit.setCustomer(savedCustomer);
            siteVisitRepository.save(visit);
        }
        List<Measurement> measurements = measurementRepository.findByLeadId(leadId);
        for (Measurement measurement : measurements) {
            if (measurement.getCustomer() == null) measurement.setCustomer(savedCustomer);
            measurementRepository.save(measurement);
        }
        List<Boq> boqs = boqRepository.findByLeadIdAndIsDeletedFalseOrderByIdDesc(leadId);
        for (Boq boq : boqs) {
            if (boq.getCustomer() == null) boq.setCustomer(savedCustomer);
            boqRepository.save(boq);
        }
        for (Quotation quotation : quotations) {
            if (quotation.getCustomer() == null) quotation.setCustomer(savedCustomer);
            quotationRepository.save(quotation);
        }
        List<Project> projects = projectRepository.findByLeadIdOrderByIdDesc(leadId);
        for (Project project : projects) {
            if (project.getCustomer() == null) project.setCustomer(savedCustomer);
            projectRepository.save(project);
        }

        // 3. Close out the lead (history stays linked via lead_id everywhere)
        lead.setIsConverted(true);
        lead.setConvertedToCustomer(savedCustomer);
        lead.setConvertedBy(user);
        lead.setConvertedDate(LocalDateTime.now());
        if (request != null) lead.setConversionNotes(request.getNotes());
        leadRepository.save(lead);

        updateLeadStatus(leadId, "Project Confirmed", "Converted to customer", user);
        logActivity(lead, "CONVERTED", "Lead converted. Customer #" + savedCustomer.getId(), user);
        notifyLeadTeam(lead, user, "Lead converted",
                lead.getLeadNumber() + " (" + lead.getName() + ") was converted to a customer.");

        LeadConversionResultDTO result = new LeadConversionResultDTO();
        result.setLeadId(lead.getId());
        result.setCustomerId(savedCustomer.getId());
        result.setCustomerName(savedCustomer.getName());
        result.setLinkedQuotations(quotations.size());
        result.setLinkedSiteVisits(visits.size());
        result.setLinkedMeasurements(measurements.size());
        return result;
    }

    // =====================================================================
    // Reports
    // =====================================================================

    public LeadReportsDTO getReports() {
        LeadReportsDTO reports = new LeadReportsDTO();

        List<LeadReportsDTO.SourceAnalysis> sources = new ArrayList<>();
        for (Object[] row : leadRepository.aggregateBySource()) {
            long total = ((Number) row[1]).longValue();
            long converted = ((Number) row[2]).longValue();
            sources.add(new LeadReportsDTO.SourceAnalysis((String) row[0], total, converted,
                    ((Number) row[3]).longValue(), toBigDecimal(row[4]),
                    total == 0 ? 0 : Math.round(converted * 1000.0 / total) / 10.0));
        }
        reports.setSourceAnalysis(sources);

        List<LeadReportsDTO.EmployeePerformance> performance = new ArrayList<>();
        for (Object[] row : leadRepository.aggregateByExecutive()) {
            long total = ((Number) row[2]).longValue();
            long converted = ((Number) row[3]).longValue();
            performance.add(new LeadReportsDTO.EmployeePerformance((Long) row[0], (String) row[1],
                    total, converted, ((Number) row[4]).longValue(), toBigDecimal(row[5]),
                    total == 0 ? 0 : Math.round(converted * 1000.0 / total) / 10.0));
        }
        reports.setEmployeePerformance(performance);

        List<LeadReportsDTO.MonthlyLeads> monthly = new ArrayList<>();
        for (Object[] row : leadRepository.aggregateMonthly(LocalDateTime.now().minusMonths(12))) {
            monthly.add(new LeadReportsDTO.MonthlyLeads((String) row[0],
                    ((Number) row[1]).longValue(), ((Number) row[2]).longValue()));
        }
        reports.setMonthlyLeads(monthly);

        List<LeadReportsDTO.LostReason> lostReasons = new ArrayList<>();
        for (Object[] row : leadRepository.aggregateLostReasons()) {
            lostReasons.add(new LeadReportsDTO.LostReason((String) row[0], ((Number) row[1]).longValue()));
        }
        reports.setLostReasons(lostReasons);

        List<LeadReportsDTO.ForecastRow> forecast = new ArrayList<>();
        BigDecimal pipelineTotal = BigDecimal.ZERO;
        for (Object[] row : leadRepository.aggregateOpenPipeline(LeadWorkflow.CLOSED_STATUSES)) {
            String status = (String) row[0];
            BigDecimal expected = toBigDecimal(row[2]);
            double weight = FORECAST_WEIGHTS.getOrDefault(status, 0.2);
            BigDecimal weighted = expected.multiply(BigDecimal.valueOf(weight))
                    .setScale(2, RoundingMode.HALF_UP);
            forecast.add(new LeadReportsDTO.ForecastRow(status, ((Number) row[1]).longValue(),
                    expected, weighted));
            pipelineTotal = pipelineTotal.add(expected);
        }
        reports.setRevenueForecast(forecast);
        reports.setTotalPipelineValue(pipelineTotal);

        reports.setAverageSalesCycleDays(leadRepository.averageSalesCycleDays());
        long total = leadRepository.countByIsDeletedFalse();
        long converted = leadRepository.countByIsDeletedFalseAndIsConvertedTrue();
        reports.setConversionRate(total == 0 ? 0 : Math.round(converted * 1000.0 / total) / 10.0);
        return reports;
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal bd) return bd;
        return new BigDecimal(value.toString());
    }

    // =====================================================================
    // Meta
    // =====================================================================

    public List<UserSummaryDTO> getAssignableUsers() {
        return userRepository.findAll().stream()
                .filter(u -> !Boolean.TRUE.equals(u.getIsDeleted()))
                .map(UserSummaryDTO::from)
                .toList();
    }

    public Map<String, Object> getMeta() {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("sources", LeadWorkflow.SOURCES);
        meta.put("types", LeadWorkflow.TYPES);
        meta.put("statuses", LeadWorkflow.STATUSES);
        meta.put("stages", LeadWorkflow.STAGES);
        meta.put("temperatures", LeadWorkflow.TEMPERATURES);
        meta.put("taskTypes", LeadWorkflow.TASK_TYPES);
        meta.put("documentCategories", LeadWorkflow.DOCUMENT_CATEGORIES);
        meta.put("communicationTypes", LeadWorkflow.COMMUNICATION_TYPES);
        return meta;
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    public void logActivity(Lead lead, String action, String description, User performedBy) {
        LeadActivity activity = new LeadActivity();
        activity.setLead(lead);
        activity.setAction(action);
        activity.setDescription(description);
        activity.setPerformedBy(performedBy);
        leadActivityRepository.save(activity);
    }

    /** Notify the lead's sales executive (and owner) unless they performed the action themselves. */
    private void notifyLeadTeam(Lead lead, User actor, String title, String message) {
        Set<Long> recipients = new LinkedHashSet<>();
        if (lead.getAssignedSalesExecutive() != null) recipients.add(lead.getAssignedSalesExecutive().getId());
        if (lead.getLeadOwner() != null) recipients.add(lead.getLeadOwner().getId());
        if (actor != null) recipients.remove(actor.getId());
        for (Long recipientId : recipients) {
            notificationService.dispatch(title, message, "LEAD", recipientId, "/leads/" + lead.getId());
        }
    }
}
