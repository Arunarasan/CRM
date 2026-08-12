package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
public class ProjectService {

    @Autowired
    private ProjectRepository projectRepository;
    
    @Autowired
    private ProjectStageRepository stageRepository;
    
    @Autowired
    private ProjectDailyLogRepository dailyLogRepository;
    
    @Autowired
    private ProjectQualityCheckRepository qualityCheckRepository;
    
    @Autowired
    private ProjectCustomerApprovalRepository approvalRepository;
    
    @Autowired
    private ProjectActivityLogRepository activityLogRepository;
    
    @Autowired
    private ProjectIssueRepository issueRepository;
    
    @Autowired
    private ProjectRiskRepository riskRepository;
    
    @Autowired
    private ProjectDocumentRepository documentRepository;
    
    @Autowired
    private ProjectPaymentRepository paymentRepository;

    @Autowired
    private SiteVisitRepository siteVisitRepository;

    @Autowired
    private SiteVisitAssignmentRepository siteVisitAssignmentRepository;

    @Autowired
    private ProjectPhaseRepository phaseRepository;

    @Autowired
    private ProjectRoomRepository roomRepository;

    @Autowired
    private ProjectRoomItemRepository roomItemRepository;

    @Autowired
    private ProjectItemProgressLogRepository itemProgressLogRepository;

    @Autowired
    private WorkforceResourceService workforceResourceService;

    /** Source of the room's type/structure — BoqItem only carries the room name. */
    @Autowired
    private MeasurementRoomRepository measurementRoomRepository;

    @Autowired
    private ProjectMaterialRequirementRepository materialRequirementRepository;

    @Autowired
    private ProjectDailyLogEmployeeRepository dailyLogEmployeeRepository;

    @Autowired
    private ProjectDailyLogMaterialRepository dailyLogMaterialRepository;

    @Autowired
    private ProjectDailyLogMediaRepository dailyLogMediaRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskChecklistService taskChecklistService;

    @Autowired
    private ContractorRepository contractorRepository;

    @Autowired
    private ContractorProjectRepository contractorProjectRepository;

    @Autowired
    private ProjectTeamRepository projectTeamRepository;

    @Autowired
    private BoqPhaseRepository boqPhaseRepository;

    @Autowired
    private BoqItemRepository boqItemRepository;

    @Autowired
    private BoqItemMaterialRepository boqItemMaterialRepository;

    @Autowired
    private PurchaseOrderRepository purchaseOrderRepository;

    @Autowired
    private PurchaseOrderItemRepository purchaseOrderItemRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private com.arudra.crm.repository.InventoryTransactionRepository inventoryTransactionRepository;

    @Autowired
    private com.arudra.crm.repository.ProductRepository productRepository;

    public Page<Project> getProjects(String search, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("id").descending());
        if (search != null && !search.isEmpty()) {
            return projectRepository.searchProjects(search, pageRequest);
        }
        return projectRepository.findAll(pageRequest);
    }

    public Project getProjectById(Long id) {
        return projectRepository.findById(id).orElseThrow(() -> new RuntimeException("Project not found"));
    }
    
    public Map<String, Object> getProjectDashboard(Long id) {
        Project project = getProjectById(id);
        
        List<ProjectStage> stages = stageRepository.findByProjectIdOrderByDueDateAsc(id);
        List<ProjectDailyLog> dailyLogs = dailyLogRepository.findByProjectIdOrderByLogDateDesc(id);
        List<ProjectQualityCheck> qualityChecks = qualityCheckRepository.findByProjectId(id);
        List<ProjectCustomerApproval> approvals = approvalRepository.findByProjectId(id);
        List<ProjectActivityLog> activityLogs = activityLogRepository.findByProjectIdOrderByTimeDesc(id);
        List<ProjectIssue> issues = issueRepository.findByProjectId(id);
        List<ProjectRisk> risks = riskRepository.findByProjectId(id);
        List<ProjectDocument> documents = documentRepository.findByProjectId(id);
        List<ProjectPayment> payments = paymentRepository.findByProjectId(id);
        
        return Map.of(
            "project", project,
            "stages", stages,
            "dailyLogs", dailyLogs,
            "qualityChecks", qualityChecks,
            "approvals", approvals,
            "activityLogs", activityLogs,
            "issues", issues,
            "risks", risks,
            "documents", documents,
            "payments", payments
        );
    }

    /**
     * Standalone project creation is intentionally blocked: a Project must originate from an
     * approved Quotation (Measurement → BOQ → Quotation → Project), via
     * QuotationService.convertToProject — which saves through the repository directly, so this
     * guard only faces external API callers.
     */
    public Project createProject(Project project) {
        throw new IllegalStateException(
                "A project must be created from an approved quotation — open the quotation and use 'Approve & Create Project'.");
    }

    /** Workflow action: moves an approved-and-converted project from PLANNING into execution. */
    public Project startExecution(Long id, User user) {
        Project project = getProjectById(id);
        if (!"PLANNING".equalsIgnoreCase(project.getStatus()) && !"PENDING".equalsIgnoreCase(project.getStatus())
                && !"APPROVED".equalsIgnoreCase(project.getStatus())) {
            throw new IllegalStateException("Execution can only be started from PLANNING/PENDING/APPROVED. Current status: "
                    + project.getStatus());
        }
        project.setStatus("RUNNING");
        if (project.getStartDate() == null) {
            project.setStartDate(java.time.LocalDate.now());
        }
        Project saved = projectRepository.save(project);

        ProjectActivityLog log = new ProjectActivityLog();
        log.setProject(saved);
        log.setUser(user);
        log.setRole("System");
        log.setDescription("Execution started");
        activityLogRepository.save(log);
        return saved;
    }

    public Project updateProject(Long id, Project projectDetails) {
        Project project = getProjectById(id);
        
        project.setProjectName(projectDetails.getProjectName());
        project.setCustomer(projectDetails.getCustomer());
        project.setLead(projectDetails.getLead());
        project.setSiteVisit(projectDetails.getSiteVisit());
        project.setMeasurement(projectDetails.getMeasurement());
        project.setProjectType(projectDetails.getProjectType());
        project.setPriority(projectDetails.getPriority());
        project.setProjectCategory(projectDetails.getProjectCategory());
        project.setStartDate(projectDetails.getStartDate());
        project.setEndDate(projectDetails.getEndDate());
        project.setActualCompletionDate(projectDetails.getActualCompletionDate());
        project.setWarrantyEndDate(projectDetails.getWarrantyEndDate());
        project.setStatus(projectDetails.getStatus());
        // progress is auto-derived from the phase rollup — ignore any value in the payload.
        project.setBudget(projectDetails.getBudget());
        project.setSpentAmount(projectDetails.getSpentAmount());
        project.setProjectDescription(projectDetails.getProjectDescription());
        project.setInternalNotes(projectDetails.getInternalNotes());
        project.setCustomerNotes(projectDetails.getCustomerNotes());
        project.setProjectNotes(projectDetails.getProjectNotes());
        
        return projectRepository.save(project);
    }

    public void deleteProject(Long id) {
        Project project = getProjectById(id);
        projectRepository.delete(project);
    }
    
    public ProjectStage addStage(Long projectId, ProjectStage stage) {
        Project project = getProjectById(projectId);
        stage.setProject(project);
        return stageRepository.save(stage);
    }
    
    public ProjectDailyLog addDailyLog(Long projectId, ProjectDailyLog log, User user) {
        Project project = getProjectById(projectId);
        log.setProject(project);
        log.setReportedBy(user);
        return dailyLogRepository.save(log);
    }
    
    public ProjectQualityCheck addQualityCheck(Long projectId, ProjectQualityCheck check, User user) {
        Project project = getProjectById(projectId);
        check.setProject(project);
        check.setInspector(user);
        return qualityCheckRepository.save(check);
    }

    public ProjectCustomerApproval addCustomerApproval(Long projectId, ProjectCustomerApproval approval) {
        Project project = getProjectById(projectId);
        approval.setProject(project);
        return approvalRepository.save(approval);
    }
    
    public ProjectActivityLog addActivityLog(Long projectId, ProjectActivityLog log, User user) {
        Project project = getProjectById(projectId);
        log.setProject(project);
        log.setUser(user);
        return activityLogRepository.save(log);
    }
    
    public ProjectIssue addIssue(Long projectId, ProjectIssue issue) {
        Project project = getProjectById(projectId);
        issue.setProject(project);
        return issueRepository.save(issue);
    }
    
    public ProjectRisk addRisk(Long projectId, ProjectRisk risk) {
        Project project = getProjectById(projectId);
        risk.setProject(project);
        return riskRepository.save(risk);
    }
    
    public ProjectDocument addDocument(Long projectId, ProjectDocument document, User user) {
        Project project = getProjectById(projectId);
        document.setProject(project);
        document.setUploadedBy(user);
        return documentRepository.save(document);
    }

    /** Point an existing document row at a new (e.g. edited) file, keeping its type/remarks/history. */
    public ProjectDocument replaceDocumentFile(Long docId, String fileUrl, String fileName) {
        ProjectDocument doc = documentRepository.findById(docId)
                .orElseThrow(() -> new RuntimeException("Document not found"));
        if (fileUrl != null && !fileUrl.isBlank()) doc.setFileUrl(fileUrl);
        if (fileName != null && !fileName.isBlank()) {
            doc.setFileName(fileName.length() > 200 ? fileName.substring(0, 200) : fileName);
        }
        return documentRepository.save(doc);
    }

    public ProjectPayment addPayment(Long projectId, ProjectPayment payment, User user) {
        Project project = getProjectById(projectId);
        payment.setProject(project);
        payment.setReceivedBy(user);
        return paymentRepository.save(payment);
    }
    
    public Project completeProject(Long projectId, String certificateBase64) {
        Project project = getProjectById(projectId);
        project.setStatus("COMPLETED");
        project.setProgress(100);
        project.setActualCompletionDate(java.time.LocalDate.now());
        project.setCompletionCertificateBase64(certificateBase64);
        return projectRepository.save(project);
    }

    /** Site visit summary for the Project detail page: totals, latest/upcoming visit and assigned employees. */
    public Map<String, Object> getSiteVisitsSummary(Long projectId) {
        getProjectById(projectId);
        List<SiteVisit> visits = siteVisitRepository.findByProjectIdAndIsDeletedFalseOrderByScheduledDateDesc(projectId);
        java.time.LocalDate today = java.time.LocalDate.now();

        Map<String, Object> summary = new java.util.LinkedHashMap<>();
        summary.put("totalVisits", visits.size());
        summary.put("latestVisit", visits.stream()
                .filter(v -> v.getScheduledDate() != null && !v.getScheduledDate().isAfter(today))
                .findFirst().map(com.arudra.crm.dto.sitevisit.SiteVisitListItemDTO::from).orElse(null));
        summary.put("upcomingVisit", visits.stream()
                .filter(v -> v.getScheduledDate() != null && v.getScheduledDate().isAfter(today))
                .min(java.util.Comparator.comparing(SiteVisit::getScheduledDate))
                .map(com.arudra.crm.dto.sitevisit.SiteVisitListItemDTO::from).orElse(null));

        java.util.Map<Long, String> employeeNames = new java.util.LinkedHashMap<>();
        for (SiteVisit v : visits) {
            for (SiteVisitAssignment a : siteVisitAssignmentRepository.findBySiteVisitId(v.getId())) {
                if (a.getAssignedUser() != null) {
                    employeeNames.put(a.getAssignedUser().getId(), a.getAssignedUser().getName());
                }
            }
        }
        summary.put("assignedEmployees", employeeNames.values());
        summary.put("recentVisits", visits.stream().limit(5)
                .map(com.arudra.crm.dto.sitevisit.SiteVisitListItemDTO::from).toList());
        return summary;
    }

    // =====================================================================
    // Phases
    // =====================================================================

    public List<ProjectPhase> getPhases(Long projectId) {
        return phaseRepository.findByProjectIdOrderBySequenceAsc(projectId);
    }

    public ProjectPhase getPhaseById(Long phaseId) {
        return phaseRepository.findById(phaseId).orElseThrow(() -> new RuntimeException("Project phase not found"));
    }

    public ProjectPhase addPhase(Long projectId, ProjectPhase phase) {
        phase.setProject(getProjectById(projectId));
        return phaseRepository.save(phase);
    }

    public ProjectPhase updatePhase(Long phaseId, ProjectPhase details) {
        ProjectPhase phase = getPhaseById(phaseId);
        phase.setName(details.getName());
        phase.setSequence(details.getSequence());
        phase.setStatus(details.getStatus());
        phase.setBudget(details.getBudget());
        phase.setEstimatedCost(details.getEstimatedCost());
        phase.setActualCost(details.getActualCost());
        phase.setStartDate(details.getStartDate());
        phase.setEndDate(details.getEndDate());
        phase.setRemarks(details.getRemarks());
        // completionPercentage is auto-maintained by the rollup — never set from the payload.
        // status stays settable here so a manager can flag ON_HOLD; the rollup respects ON_HOLD.
        return phaseRepository.save(phase);
    }

    public void deletePhase(Long phaseId) {
        phaseRepository.delete(getPhaseById(phaseId));
    }

    // =====================================================================
    // Rooms
    // =====================================================================

    public List<ProjectRoom> getRooms(Long phaseId) {
        return roomRepository.findByPhaseIdOrderByIdAsc(phaseId);
    }

    public ProjectRoom getRoomById(Long roomId) {
        return roomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Project room not found"));
    }

    public ProjectRoom addRoom(Long phaseId, ProjectRoom room) {
        room.setPhase(getPhaseById(phaseId));
        return roomRepository.save(room);
    }

    public ProjectRoom updateRoom(Long roomId, ProjectRoom details) {
        ProjectRoom room = getRoomById(roomId);
        room.setRoomName(details.getRoomName());
        room.setFloorName(details.getFloorName());
        room.setRoomType(details.getRoomType());
        room.setRemarks(details.getRemarks());
        // completionPercentage / status are auto-maintained by the rollup — never set from the payload.
        return roomRepository.save(room);
    }

    public void deleteRoom(Long roomId) {
        roomRepository.delete(getRoomById(roomId));
    }

    // =====================================================================
    // Room items
    // =====================================================================

    public List<ProjectRoomItem> getItems(Long roomId) {
        List<ProjectRoomItem> items = roomItemRepository.findByRoomIdOrderByIdAsc(roomId);
        items.forEach(this::resolveAssignedResource);
        return items;
    }

    public ProjectRoomItem getItemById(Long itemId) {
        return roomItemRepository.findById(itemId).orElseThrow(() -> new RuntimeException("Project room item not found"));
    }

    @Transactional
    public ProjectRoomItem addItem(Long roomId, ProjectRoomItem item) {
        item.setRoom(getRoomById(roomId));
        normalizeItemLifecycle(item, null, null);
        ProjectRoomItem saved = roomItemRepository.save(item);
        logItemEvent(saved, null, "CREATED", 0, saved.getProgress(), null, saved.getStatus(),
                "Work item added", saved.getPhotos());
        recalcRoom(saved.getRoom());
        notifyItem(saved, "Task Added", saved.getItemName() + " added to " + roomName(saved));
        if (itemAssigned(saved)) {
            notifyItem(saved, "Task Assigned", saved.getItemName() + " assigned in " + roomName(saved));
        }
        resolveAssignedResource(saved);
        return saved;
    }

    /** True once this work item has a workforce resource attached. */
    private boolean itemAssigned(ProjectRoomItem item) {
        return item.getResourceType() != null && item.getResourceId() != null;
    }

    /** Populate the transient resolved-resource view for display (name/type/contact). */
    private void resolveAssignedResource(ProjectRoomItem item) {
        if (item != null && itemAssigned(item)) {
            item.setAssignedResource(workforceResourceService.resolve(item.getResourceType(), item.getResourceId()));
        }
    }

    /**
     * Full metadata + progress edit. Progress/status changes route through the same rollup and
     * timeline logging as the dedicated progress endpoint. A completed (locked) item cannot be
     * edited here — it must be reopened first by a Manager/Admin.
     */
    @Transactional
    public ProjectRoomItem updateItem(Long itemId, ProjectRoomItem details, User user) {
        ProjectRoomItem item = getItemById(itemId);
        int oldProgress = item.getProgress() == null ? 0 : item.getProgress();
        String oldStatus = item.getStatus();
        boolean wasAssigned = itemAssigned(item);

        if (Boolean.TRUE.equals(item.getLocked())) {
            throw new RuntimeException("This work item is completed and locked. A Manager/Admin must reopen it before editing.");
        }

        item.setItemType(details.getItemType());
        item.setItemName(details.getItemName());
        item.setDescription(details.getDescription());
        item.setQuantity(details.getQuantity());
        item.setUnit(details.getUnit());
        item.setRemarks(details.getRemarks());
        item.setPlannedStartDate(details.getPlannedStartDate());
        item.setPlannedEndDate(details.getPlannedEndDate());
        item.setActualStartDate(details.getActualStartDate());
        // Unified workforce assignment (validated); null clears the assignment.
        String newType = com.arudra.crm.entity.ResourceType.normalize(details.getResourceType());
        if (newType != null && details.getResourceId() != null) {
            if (!workforceResourceService.exists(newType, details.getResourceId())) {
                throw new RuntimeException("Unknown workforce resource: " + newType + " #" + details.getResourceId());
            }
            item.setResourceType(newType);
            item.setResourceId(details.getResourceId());
        } else {
            item.setResourceType(null);
            item.setResourceId(null);
        }
        if (details.getPhotos() != null) item.setPhotos(details.getPhotos());
        if (details.getProgress() != null) item.setProgress(details.getProgress());
        if (details.getStatus() != null) item.setStatus(details.getStatus());

        return applyItemChange(item, user, oldProgress, oldStatus, wasAssigned, details.getRemarks());
    }

    /** Lightweight progress update used by the work-item card (progress slider + status + note + photos). */
    @Transactional
    public ProjectRoomItem updateItemProgress(Long itemId, Integer progress, String status,
                                              String remarks, String photos, User user) {
        ProjectRoomItem item = getItemById(itemId);
        int oldProgress = item.getProgress() == null ? 0 : item.getProgress();
        String oldStatus = item.getStatus();

        if (Boolean.TRUE.equals(item.getLocked())) {
            throw new RuntimeException("This work item is completed and locked. A Manager/Admin must reopen it before updating progress.");
        }

        if (progress != null) item.setProgress(progress);
        if (status != null && !status.isBlank()) item.setStatus(status);
        if (photos != null) item.setPhotos(photos);
        if (remarks != null && !remarks.isBlank()) item.setRemarks(remarks);

        boolean wasAssigned = itemAssigned(item);
        return applyItemChange(item, user, oldProgress, oldStatus, wasAssigned, remarks);
    }

    /** Manager/Admin reopen of a completed item: clears the lock and drops it back to IN_PROGRESS. */
    @Transactional
    public ProjectRoomItem reopenItem(Long itemId, User user) {
        ProjectRoomItem item = getItemById(itemId);
        int oldProgress = item.getProgress() == null ? 0 : item.getProgress();
        String oldStatus = item.getStatus();
        item.setLocked(false);
        item.setCompletedDate(null);
        if (item.getProgress() != null && item.getProgress() >= 100) item.setProgress(99);
        item.setStatus("IN_PROGRESS");
        ProjectRoomItem saved = roomItemRepository.save(item);
        logItemEvent(saved, user, "REOPENED", oldProgress, saved.getProgress(), oldStatus, saved.getStatus(),
                "Work item reopened", null);
        recalcRoom(saved.getRoom());
        notifyItem(saved, "Task Reopened", saved.getItemName() + " was reopened in " + roomName(saved));
        return saved;
    }

    @Transactional
    public void deleteItem(Long itemId) {
        ProjectRoomItem item = getItemById(itemId);
        ProjectRoom room = item.getRoom();
        itemProgressLogRepository.deleteAll(itemProgressLogRepository.findByItemIdOrderByLogTimeAsc(itemId));
        roomItemRepository.delete(item);
        recalcRoom(room); // deleting a work item changes the room average
    }

    /**
     * Applies completion rules, appends a timeline/audit row when progress or status changed,
     * fires notifications, and rolls the change up to room/phase/project. Shared by every item mutation.
     */
    private ProjectRoomItem applyItemChange(ProjectRoomItem item, User user, int oldProgress,
                                            String oldStatus, boolean wasAssigned, String remarks) {
        normalizeItemLifecycle(item, oldProgress, oldStatus);
        ProjectRoomItem saved = roomItemRepository.save(item);

        int newProgress = saved.getProgress() == null ? 0 : saved.getProgress();
        String newStatus = saved.getStatus();
        boolean progressChanged = newProgress != oldProgress;
        boolean statusChanged = !java.util.Objects.equals(oldStatus, newStatus);

        if (progressChanged || statusChanged) {
            String event = "COMPLETED".equalsIgnoreCase(newStatus) ? "COMPLETED"
                    : progressChanged ? "PROGRESS_UPDATED" : "STATUS_CHANGED";
            logItemEvent(saved, user, event, oldProgress, newProgress, oldStatus, newStatus, remarks, saved.getPhotos());
        }

        // Notifications for the meaningful transitions.
        boolean nowAssigned = itemAssigned(saved);
        if (nowAssigned && !wasAssigned) {
            notifyItem(saved, "Task Assigned", saved.getItemName() + " assigned in " + roomName(saved));
        }
        if (statusChanged) {
            if ("STARTED".equalsIgnoreCase(newStatus) || "IN_PROGRESS".equalsIgnoreCase(newStatus)) {
                notifyItem(saved, "Task Started", saved.getItemName() + " started in " + roomName(saved));
            } else if ("INSPECTION".equalsIgnoreCase(newStatus)) {
                notifyItem(saved, "Inspection Required", saved.getItemName() + " is awaiting inspection in " + roomName(saved));
            } else if ("COMPLETED".equalsIgnoreCase(newStatus)) {
                notifyItem(saved, "Task Completed", saved.getItemName() + " completed in " + roomName(saved));
            }
        } else if (progressChanged) {
            notifyItem(saved, "Progress Updated", saved.getItemName() + " is now " + newProgress + "% in " + roomName(saved));
        }

        recalcRoom(saved.getRoom());
        resolveAssignedResource(saved);
        return saved;
    }

    /**
     * Enforces the item-level completion rules before save:
     * progress>=100 -> COMPLETED + completedDate + lock; progress moving above 0 auto-starts;
     * a still-PENDING item with an assignee becomes ASSIGNED.
     */
    private void normalizeItemLifecycle(ProjectRoomItem item, Integer oldProgress, String oldStatus) {
        Integer p = item.getProgress();
        if (p == null) { p = 0; item.setProgress(0); }
        if (p < 0) { p = 0; item.setProgress(0); }
        if (p > 100) { p = 100; item.setProgress(100); }

        if (p >= 100) {
            item.setStatus("COMPLETED");
            item.setProgress(100);
            if (item.getCompletedDate() == null) item.setCompletedDate(java.time.LocalDate.now());
            item.setLocked(true);
            if (item.getActualStartDate() == null) item.setActualStartDate(java.time.LocalDate.now());
            return;
        }

        // Below 100 -> never keep a stale COMPLETED/locked state.
        item.setLocked(false);
        if ("COMPLETED".equalsIgnoreCase(item.getStatus())) {
            item.setStatus(p > 0 ? "IN_PROGRESS" : "PENDING");
            item.setCompletedDate(null);
        }

        boolean assigned = itemAssigned(item);
        if (p > 0) {
            if (item.getStatus() == null || "PENDING".equalsIgnoreCase(item.getStatus())
                    || "ASSIGNED".equalsIgnoreCase(item.getStatus()) || "MATERIAL_READY".equalsIgnoreCase(item.getStatus())) {
                item.setStatus("IN_PROGRESS");
            }
            if (item.getActualStartDate() == null) item.setActualStartDate(java.time.LocalDate.now());
        } else { // p == 0
            if (item.getStatus() == null || "PENDING".equalsIgnoreCase(item.getStatus())) {
                item.setStatus(assigned ? "ASSIGNED" : "PENDING");
            }
        }
    }

    private void logItemEvent(ProjectRoomItem item, User user, String eventType, Integer oldProgress,
                              Integer newProgress, String oldStatus, String newStatus, String remarks, String photos) {
        ProjectItemProgressLog log = new ProjectItemProgressLog();
        log.setItem(item);
        log.setUser(user);
        log.setEventType(eventType);
        log.setOldProgress(oldProgress);
        log.setNewProgress(newProgress);
        log.setOldStatus(oldStatus);
        log.setNewStatus(newStatus);
        log.setRemarks(remarks);
        log.setPhotos(photos);
        log.setLogTime(java.time.LocalDateTime.now());
        itemProgressLogRepository.save(log);
    }

    public List<ProjectItemProgressLog> getItemTimeline(Long itemId) {
        getItemById(itemId);
        return itemProgressLogRepository.findByItemIdOrderByLogTimeAsc(itemId);
    }

    private String roomName(ProjectRoomItem item) {
        return item.getRoom() != null ? item.getRoom().getRoomName() : "room";
    }

    private void notifyItem(ProjectRoomItem item, String title, String message) {
        ProjectRoom room = item.getRoom();
        if (room == null || room.getPhase() == null || room.getPhase().getProject() == null) return;
        Project project = room.getPhase().getProject();
        String link = "/projects/" + project.getId();
        java.util.Set<Long> recipients = new java.util.LinkedHashSet<>();
        if (project.getProjectManager() != null) recipients.add(project.getProjectManager().getId());
        if (project.getSiteEngineer() != null) recipients.add(project.getSiteEngineer().getId());
        // Employee assignees get a personal notification; contractors have no login, so the PM/engineer above cover them.
        if (com.arudra.crm.entity.ResourceType.EMPLOYEE.equals(item.getResourceType()) && item.getResourceId() != null) {
            recipients.add(item.getResourceId());
        }
        for (Long uid : recipients) {
            notificationService.dispatch(title, message + " (" + project.getProjectName() + ")", "PROJECT", uid, link);
        }
    }

    // =====================================================================
    // Automatic progress rollup: Item -> Room -> Phase -> Project.
    // Incremental — each mutation recomputes only the affected room, its phase and the project.
    // =====================================================================

    private void recalcRoom(ProjectRoom room) {
        if (room == null) return;
        List<ProjectRoomItem> items = roomItemRepository.findByRoomIdOrderByIdAsc(room.getId());
        // Cancelled items don't count toward the room's completion.
        List<ProjectRoomItem> counted = items.stream()
                .filter(i -> !"CANCELLED".equalsIgnoreCase(i.getStatus())).toList();

        int pct = counted.isEmpty() ? 0 : (int) Math.round(counted.stream()
                .mapToInt(i -> i.getProgress() == null ? 0 : i.getProgress()).average().orElse(0));
        room.setCompletionPercentage(pct);

        boolean allDone = !counted.isEmpty() && counted.stream()
                .allMatch(i -> "COMPLETED".equalsIgnoreCase(i.getStatus()));
        String prevStatus = room.getStatus();
        if (allDone) {
            room.setStatus("COMPLETED");
            room.setCompletionPercentage(100);
            if (room.getCompletedDate() == null) room.setCompletedDate(java.time.LocalDate.now());
        } else if (!"ON_HOLD".equalsIgnoreCase(prevStatus)) {
            room.setStatus(pct > 0 ? "IN_PROGRESS" : "PENDING");
            room.setCompletedDate(null);
        }
        roomRepository.save(room);

        if (allDone && !"COMPLETED".equalsIgnoreCase(prevStatus)) {
            notifyRoomCompleted(room);
        }
        recalcPhase(room.getPhase());
    }

    private void recalcPhase(ProjectPhase phase) {
        if (phase == null) return;
        List<ProjectRoom> rooms = roomRepository.findByPhaseIdOrderByIdAsc(phase.getId());
        int pct = rooms.isEmpty() ? 0 : (int) Math.round(rooms.stream()
                .mapToInt(r -> r.getCompletionPercentage() == null ? 0 : r.getCompletionPercentage())
                .average().orElse(0));
        phase.setCompletionPercentage(pct);

        boolean allDone = !rooms.isEmpty() && rooms.stream()
                .allMatch(r -> "COMPLETED".equalsIgnoreCase(r.getStatus()));
        String prevStatus = phase.getStatus();
        if (allDone) {
            phase.setStatus("COMPLETED");
            phase.setCompletionPercentage(100);
            if (phase.getCompletedDate() == null) phase.setCompletedDate(java.time.LocalDate.now());
        } else if (!"ON_HOLD".equalsIgnoreCase(prevStatus)) {
            phase.setStatus(pct > 0 ? "IN_PROGRESS" : "PLANNING");
            phase.setCompletedDate(null);
        }
        phaseRepository.save(phase);

        if (allDone && !"COMPLETED".equalsIgnoreCase(prevStatus)) {
            notifyProject(phase.getProject(), "Phase Completed",
                    "Phase " + phase.getName() + " is fully completed");
        }
        recalcProject(phase.getProject());
    }

    private void recalcProject(Project project) {
        if (project == null) return;
        List<ProjectPhase> phases = phaseRepository.findByProjectIdOrderBySequenceAsc(project.getId());
        int pct = phases.isEmpty() ? 0 : (int) Math.round(phases.stream()
                .mapToInt(p -> p.getCompletionPercentage() == null ? 0 : p.getCompletionPercentage())
                .average().orElse(0));
        project.setProgress(pct);

        boolean allDone = !phases.isEmpty() && phases.stream()
                .allMatch(p -> "COMPLETED".equalsIgnoreCase(p.getStatus()));
        String prevStatus = project.getStatus();
        if (allDone && !"COMPLETED".equalsIgnoreCase(prevStatus)
                && !"CANCELLED".equalsIgnoreCase(prevStatus) && !"CLOSED".equalsIgnoreCase(prevStatus)) {
            project.setStatus("COMPLETED");
            project.setProgress(100);
            project.setActualCompletionDate(java.time.LocalDate.now());
            if (project.getStartDate() != null) {
                project.setTotalDurationDays((int) java.time.temporal.ChronoUnit.DAYS
                        .between(project.getStartDate(), project.getActualCompletionDate()));
            }
            projectRepository.save(project);
            notifyProject(project, "Project Completed",
                    project.getProjectName() + " is fully completed");
            return;
        }
        // Auto-completed earlier but a reopen dropped it back below 100.
        if (!allDone && "COMPLETED".equalsIgnoreCase(prevStatus)) {
            project.setStatus("RUNNING");
            project.setActualCompletionDate(null);
            project.setTotalDurationDays(null);
        }
        projectRepository.save(project);
    }

    private void notifyRoomCompleted(ProjectRoom room) {
        if (room.getPhase() == null) return;
        notifyProject(room.getPhase().getProject(), "Room Completed",
                "Room " + room.getRoomName() + " is fully completed");
    }

    private void notifyProject(Project project, String title, String message) {
        if (project == null) return;
        String link = "/projects/" + project.getId();
        java.util.Set<Long> recipients = new java.util.LinkedHashSet<>();
        if (project.getProjectManager() != null) recipients.add(project.getProjectManager().getId());
        if (project.getSiteEngineer() != null) recipients.add(project.getSiteEngineer().getId());
        for (Long uid : recipients) {
            notificationService.dispatch(title, message + " (" + project.getProjectName() + ")", "PROJECT", uid, link);
        }
    }

    // =====================================================================
    // Material planning
    // =====================================================================

    public List<ProjectMaterialRequirement> getMaterials(Long projectId) {
        return materialRequirementRepository.findByProjectIdOrderByIdAsc(projectId);
    }

    public ProjectMaterialRequirement getMaterialById(Long reqId) {
        return materialRequirementRepository.findById(reqId)
                .orElseThrow(() -> new RuntimeException("Material requirement not found"));
    }

    public ProjectMaterialRequirement addMaterial(Long projectId, ProjectMaterialRequirement requirement) {
        requirement.setProject(getProjectById(projectId));
        ProjectMaterialRequirement saved = materialRequirementRepository.save(requirement);
        checkMaterialShortage(saved);
        return saved;
    }

    public ProjectMaterialRequirement updateMaterial(Long reqId, ProjectMaterialRequirement details) {
        ProjectMaterialRequirement requirement = getMaterialById(reqId);
        requirement.setRequiredQty(details.getRequiredQty());
        requirement.setReservedQty(details.getReservedQty());
        requirement.setIssuedQty(details.getIssuedQty());
        requirement.setReturnedQty(details.getReturnedQty());
        requirement.setConsumedQty(details.getConsumedQty());
        requirement.setUnit(details.getUnit());
        requirement.setRemarks(details.getRemarks());
        ProjectMaterialRequirement saved = materialRequirementRepository.save(requirement);
        checkMaterialShortage(saved);
        return saved;
    }

    private void checkMaterialShortage(ProjectMaterialRequirement requirement) {
        if (requirement.getProduct() == null || requirement.getProject() == null) {
            return;
        }
        if (requirement.getRemainingQty().compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        User pm = requirement.getProject().getProjectManager();
        if (pm == null) {
            return;
        }
        notificationService.dispatch(
                "Material Shortage",
                requirement.getProduct().getName() + " is short by " + requirement.getRemainingQty()
                        + " " + (requirement.getUnit() != null ? requirement.getUnit() : "")
                        + " on " + requirement.getProject().getProjectName(),
                "PROJECT",
                pm.getId(),
                "/projects/" + requirement.getProject().getId());
    }

    public PurchaseOrder requestPurchase(Long reqId, User currentUser) {
        ProjectMaterialRequirement requirement = getMaterialById(reqId);
        BigDecimal remaining = requirement.getRemainingQty();
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("No remaining quantity to purchase for this material requirement");
        }
        Product product = requirement.getProduct();
        if (product == null) {
            throw new IllegalStateException("Material requirement has no product linked");
        }
        Supplier supplier = product.getSupplier();
        if (supplier == null) {
            throw new IllegalStateException("Product has no supplier on file; set one before requesting a purchase");
        }

        PurchaseOrder order = new PurchaseOrder();
        order.setPoNumber("PO-" + System.currentTimeMillis());
        order.setSupplier(supplier);
        order.setDate(java.time.LocalDate.now());
        order.setStatus("DRAFT");
        order.setProject(requirement.getProject());
        order.setNotes("Auto-generated from project material requirement #" + requirement.getId()
                + " (" + requirement.getProject().getProjectName() + ")");

        BigDecimal unitPrice = product.getCostPrice() != null ? product.getCostPrice() : BigDecimal.ZERO;
        BigDecimal totalPrice = unitPrice.multiply(remaining);
        order.setTotalAmount(totalPrice);
        order = purchaseOrderRepository.save(order);

        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setPurchaseOrder(order);
        item.setProduct(product);
        item.setQuantity(remaining.intValue());
        item.setUnitPrice(unitPrice);
        item.setTotalPrice(totalPrice);
        purchaseOrderItemRepository.save(item);

        requirement.setPurchaseOrder(order);
        materialRequirementRepository.save(requirement);

        if (currentUser != null) {
            notificationService.dispatch(
                    "Purchase Requested",
                    "Purchase order " + order.getPoNumber() + " created for " + product.getName(),
                    "PROJECT",
                    currentUser.getId(),
                    "/purchases/orders/" + order.getId());
        }
        return order;
    }

    // =====================================================================
    // Project-scoped stock movements (stock entry / stock reduce) + purchase summary
    // =====================================================================

    /** All inventory movements (in/out) recorded against this project, newest first. */
    public List<InventoryTransaction> getMaterialTransactions(Long projectId) {
        return inventoryTransactionRepository.findByProjectIdOrderByDateDesc(projectId);
    }

    /**
     * Records a stock entry (inbound: PURCHASE/OPENING/ADJUSTMENT/PROJECT_RETURN) or a stock
     * reduction (outbound: CONSUMPTION) against this project's inventory. Delegates the actual
     * stock math to InventoryService, tags the transaction with the project, and keeps the
     * matching material-requirement's issued/returned counters in sync so the planning table stays honest.
     */
    @Transactional
    public InventoryTransaction recordMaterialTransaction(Long projectId, InventoryTransaction tx) {
        Project project = getProjectById(projectId);
        if (tx.getProduct() == null || tx.getProduct().getId() == null) {
            throw new IllegalStateException("A product is required to record a stock movement");
        }
        Product product = productRepository.findById(tx.getProduct().getId())
                .orElseThrow(() -> new RuntimeException("Product not found"));
        if (tx.getQuantity() == null || tx.getQuantity() <= 0) {
            throw new IllegalStateException("Quantity must be greater than zero");
        }
        tx.setProduct(product);
        tx.setProject(project);
        InventoryTransaction saved = inventoryService.processTransaction(tx);

        // Keep the project's material-requirement counters aligned with what actually moved.
        materialRequirementRepository.findByProjectIdOrderByIdAsc(projectId).stream()
                .filter(r -> r.getProduct() != null && r.getProduct().getId().equals(product.getId()))
                .findFirst()
                .ifPresent(req -> {
                    BigDecimal qty = BigDecimal.valueOf(saved.getQuantity());
                    String type = saved.getType();
                    if ("CONSUMPTION".equals(type)) {
                        req.setIssuedQty(nz(req.getIssuedQty()).add(qty));
                        req.setConsumedQty(nz(req.getConsumedQty()).add(qty));
                    } else if ("PROJECT_RETURN".equals(type)) {
                        req.setReturnedQty(nz(req.getReturnedQty()).add(qty));
                    }
                    materialRequirementRepository.save(req);
                });
        return saved;
    }

    private BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    /** Aggregates this project's inbound PURCHASE movements per product into a purchase-summary list. */
    public List<Map<String, Object>> getMaterialPurchaseSummary(Long projectId) {
        List<InventoryTransaction> purchases = inventoryTransactionRepository.findByTypeAndProjectId("PURCHASE", projectId);
        Map<Long, Map<String, Object>> byProduct = new java.util.LinkedHashMap<>();
        for (InventoryTransaction tx : purchases) {
            Product p = tx.getProduct();
            if (p == null) continue;
            BigDecimal unitCost = p.getCostPrice() != null ? p.getCostPrice()
                    : (p.getPurchasePrice() != null ? p.getPurchasePrice()
                    : (p.getPrice() != null ? p.getPrice() : BigDecimal.ZERO));
            BigDecimal qty = BigDecimal.valueOf(tx.getQuantity());
            Map<String, Object> row = byProduct.computeIfAbsent(p.getId(), k -> {
                Map<String, Object> m = new java.util.LinkedHashMap<>();
                m.put("productId", p.getId());
                m.put("productName", p.getName());
                m.put("materialCode", p.getMaterialCode());
                m.put("unit", p.getUnit());
                m.put("totalQty", BigDecimal.ZERO);
                m.put("totalValue", BigDecimal.ZERO);
                m.put("entries", 0);
                m.put("lastPurchaseDate", null);
                return m;
            });
            row.put("totalQty", ((BigDecimal) row.get("totalQty")).add(qty));
            row.put("totalValue", ((BigDecimal) row.get("totalValue")).add(unitCost.multiply(qty)));
            row.put("entries", ((Integer) row.get("entries")) + 1);
            Object last = row.get("lastPurchaseDate");
            if (tx.getDate() != null && (last == null || tx.getDate().isAfter((java.time.LocalDateTime) last))) {
                row.put("lastPurchaseDate", tx.getDate());
            }
        }
        return new java.util.ArrayList<>(byProduct.values());
    }

    // =====================================================================
    // Daily log children (employees present / materials used / photos+videos)
    // =====================================================================

    public Map<String, Object> getDailyLogDetail(Long logId) {
        ProjectDailyLog log = dailyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("Daily log not found"));
        return Map.of(
                "log", log,
                "employees", dailyLogEmployeeRepository.findByDailyLogId(logId),
                "materials", dailyLogMaterialRepository.findByDailyLogId(logId),
                "media", dailyLogMediaRepository.findByDailyLogId(logId));
    }

    public ProjectDailyLogEmployee addDailyLogEmployee(Long logId, ProjectDailyLogEmployee entry) {
        entry.setDailyLog(dailyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("Daily log not found")));
        return dailyLogEmployeeRepository.save(entry);
    }

    public ProjectDailyLogMaterial addDailyLogMaterial(Long logId, ProjectDailyLogMaterial entry) {
        entry.setDailyLog(dailyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("Daily log not found")));
        return dailyLogMaterialRepository.save(entry);
    }

    public ProjectDailyLogMedia addDailyLogMedia(Long logId, ProjectDailyLogMedia entry) {
        entry.setDailyLog(dailyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("Daily log not found")));
        return dailyLogMediaRepository.save(entry);
    }

    // =====================================================================
    // Customer approval workflow
    // =====================================================================

    public ProjectCustomerApproval decideApproval(Long approvalId, boolean approve, String remarks, User currentUser) {
        ProjectCustomerApproval approval = approvalRepository.findById(approvalId)
                .orElseThrow(() -> new RuntimeException("Customer approval not found"));
        approval.setStatus(approve ? "APPROVED" : "REJECTED");
        approval.setApprovalDate(java.time.LocalDateTime.now());
        if (remarks != null) {
            approval.setRemarks(remarks);
        }
        ProjectCustomerApproval saved = approvalRepository.save(approval);

        ProjectActivityLog activity = new ProjectActivityLog();
        activity.setProject(saved.getProject());
        activity.setUser(currentUser);
        activity.setRole(currentUser != null ? currentUser.getName() : "Customer");
        activity.setDescription(saved.getApprovalType() + " was " + (approve ? "approved" : "rejected")
                + (remarks != null && !remarks.isBlank() ? ": " + remarks : ""));
        activityLogRepository.save(activity);

        User pm = saved.getProject().getProjectManager();
        if (pm != null) {
            notificationService.dispatch(
                    saved.getApprovalType() + (approve ? " Approved" : " Rejected"),
                    "Customer " + (approve ? "approved" : "rejected") + " " + saved.getApprovalType()
                            + " on " + saved.getProject().getProjectName(),
                    "PROJECT",
                    pm.getId(),
                    "/projects/" + saved.getProject().getId());
        }
        return saved;
    }

    // =====================================================================
    // Progress rollup
    // =====================================================================

    public Map<String, Object> getProgress(Long projectId) {
        Project project = getProjectById(projectId);
        List<ProjectPhase> phases = phaseRepository.findByProjectIdOrderBySequenceAsc(projectId);
        List<ProjectRoom> rooms = roomRepository.findByPhaseProjectId(projectId);
        List<Task> tasks = taskRepository.findByProjectId(projectId);
        List<ProjectMaterialRequirement> materials = materialRequirementRepository.findByProjectIdOrderByIdAsc(projectId);

        double phasePct = phases.isEmpty() ? 0 : phases.stream()
                .mapToInt(p -> p.getCompletionPercentage() == null ? 0 : p.getCompletionPercentage())
                .average().orElse(0);
        double roomPct = rooms.isEmpty() ? 0 : rooms.stream()
                .mapToInt(r -> r.getCompletionPercentage() == null ? 0 : r.getCompletionPercentage())
                .average().orElse(0);
        long completedTasks = tasks.stream().filter(t -> "COMPLETED".equalsIgnoreCase(t.getStatus())).count();
        double taskPct = tasks.isEmpty() ? 0 : (completedTasks * 100.0 / tasks.size());

        BigDecimal totalRequired = materials.stream().map(ProjectMaterialRequirement::getRequiredQty)
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalIssued = materials.stream().map(ProjectMaterialRequirement::getIssuedQty)
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        double materialPct = totalRequired.compareTo(BigDecimal.ZERO) == 0 ? 0
                : totalIssued.multiply(BigDecimal.valueOf(100))
                        .divide(totalRequired, 2, java.math.RoundingMode.HALF_UP).doubleValue();

        BigDecimal budget = project.getBudget() != null ? project.getBudget() : BigDecimal.ZERO;
        BigDecimal spent = project.getActualCost() != null ? project.getActualCost()
                : (project.getSpentAmount() != null ? project.getSpentAmount() : BigDecimal.ZERO);
        double financialPct = budget.compareTo(BigDecimal.ZERO) == 0 ? 0
                : spent.multiply(BigDecimal.valueOf(100)).divide(budget, 2, java.math.RoundingMode.HALF_UP).doubleValue();

        double overallPct = java.util.List.of(phasePct, roomPct, taskPct, materialPct).stream()
                .mapToDouble(Double::doubleValue).average().orElse(0);

        Map<String, Object> progress = new java.util.LinkedHashMap<>();
        progress.put("overallPercent", Math.round(overallPct));
        progress.put("phasePercent", Math.round(phasePct));
        progress.put("roomPercent", Math.round(roomPct));
        progress.put("taskPercent", Math.round(taskPct));
        progress.put("materialPercent", Math.round(materialPct));
        progress.put("financialPercent", Math.round(financialPct));
        return progress;
    }

    /**
     * Live progress dashboard for a single project: overall %, work-item status counts,
     * delayed/inspection counts, room/floor/phase completion, and a per-floor breakdown.
     * "Floor" is computed here by grouping rooms on floorName within a phase (no Floor entity).
     */
    public Map<String, Object> getProgressDashboard(Long projectId) {
        Project project = getProjectById(projectId);
        List<ProjectPhase> phases = phaseRepository.findByProjectIdOrderBySequenceAsc(projectId);
        List<ProjectRoom> rooms = roomRepository.findByPhaseProjectId(projectId);
        List<ProjectRoomItem> items = roomItemRepository.findByRoomPhaseProjectId(projectId);

        long completedTasks = items.stream().filter(i -> "COMPLETED".equalsIgnoreCase(i.getStatus())).count();
        long inProgressTasks = items.stream().filter(i -> "IN_PROGRESS".equalsIgnoreCase(i.getStatus())
                || "STARTED".equalsIgnoreCase(i.getStatus())).count();
        long inspectionPending = items.stream().filter(i -> "INSPECTION".equalsIgnoreCase(i.getStatus())).count();
        long cancelledTasks = items.stream().filter(i -> "CANCELLED".equalsIgnoreCase(i.getStatus())).count();
        long delayedTasks = items.stream().filter(ProjectRoomItem::isDelayed).count();
        long pendingTasks = items.size() - completedTasks - inProgressTasks - inspectionPending - cancelledTasks;
        if (pendingTasks < 0) pendingTasks = 0;

        long completedRooms = rooms.stream().filter(r -> "COMPLETED".equalsIgnoreCase(r.getStatus())).count();
        long completedPhases = phases.stream().filter(p -> "COMPLETED".equalsIgnoreCase(p.getStatus())).count();

        // Which rooms have at least one delayed item (for delayed-rooms / delayed-phases counts).
        java.util.Set<Long> delayedRoomIds = items.stream().filter(ProjectRoomItem::isDelayed)
                .map(i -> i.getRoom() != null ? i.getRoom().getId() : null)
                .filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toSet());

        // Floor breakdown: group rooms by (phase, floorName). floorName null -> "General".
        java.util.Map<String, List<ProjectRoom>> floorGroups = new java.util.LinkedHashMap<>();
        java.util.Map<String, String> floorPhaseName = new java.util.HashMap<>();
        for (ProjectRoom r : rooms) {
            ProjectPhase ph = r.getPhase();
            String phaseName = ph != null ? ph.getName() : "";
            Long phaseId = ph != null ? ph.getId() : 0L;
            String floor = (r.getFloorName() != null && !r.getFloorName().isBlank()) ? r.getFloorName() : "General";
            String key = phaseId + "|" + floor;
            floorGroups.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(r);
            floorPhaseName.put(key, phaseName);
        }
        List<Map<String, Object>> floors = new java.util.ArrayList<>();
        long completedFloors = 0;
        long delayedFloors = 0;
        for (Map.Entry<String, List<ProjectRoom>> e : floorGroups.entrySet()) {
            List<ProjectRoom> fr = e.getValue();
            int pct = fr.isEmpty() ? 0 : (int) Math.round(fr.stream()
                    .mapToInt(r -> r.getCompletionPercentage() == null ? 0 : r.getCompletionPercentage())
                    .average().orElse(0));
            boolean allDone = !fr.isEmpty() && fr.stream().allMatch(r -> "COMPLETED".equalsIgnoreCase(r.getStatus()));
            boolean delayed = fr.stream().anyMatch(r -> delayedRoomIds.contains(r.getId()));
            if (allDone) completedFloors++;
            if (delayed) delayedFloors++;
            String floorName = e.getKey().substring(e.getKey().indexOf('|') + 1);
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("phaseName", floorPhaseName.get(e.getKey()));
            row.put("floorName", floorName);
            row.put("progress", pct);
            row.put("roomCount", fr.size());
            row.put("completed", allDone);
            row.put("delayed", delayed);
            floors.add(row);
        }

        long delayedPhases = rooms.stream()
                .filter(r -> delayedRoomIds.contains(r.getId()))
                .map(r -> r.getPhase() != null ? r.getPhase().getId() : null)
                .filter(java.util.Objects::nonNull).distinct().count();

        Map<String, Object> d = new java.util.LinkedHashMap<>();
        d.put("overallProgress", project.getProgress() == null ? 0 : project.getProgress());
        d.put("projectStatus", project.getStatus());
        d.put("totalTasks", items.size());
        d.put("completedTasks", completedTasks);
        d.put("pendingTasks", pendingTasks);
        d.put("inProgressTasks", inProgressTasks);
        d.put("delayedTasks", delayedTasks);
        d.put("inspectionPending", inspectionPending);
        d.put("totalRooms", rooms.size());
        d.put("completedRooms", completedRooms);
        d.put("delayedRooms", delayedRoomIds.size());
        d.put("totalFloors", floorGroups.size());
        d.put("completedFloors", completedFloors);
        d.put("delayedFloors", delayedFloors);
        d.put("totalPhases", phases.size());
        d.put("completedPhases", completedPhases);
        d.put("delayedPhases", delayedPhases);
        d.put("floors", floors);
        return d;
    }

    // =====================================================================
    // Module dashboard
    // =====================================================================

    public Map<String, Object> getModuleDashboard() {
        List<Project> allProjects = projectRepository.findAll();
        java.time.LocalDate today = java.time.LocalDate.now();

        long total = allProjects.size();
        long running = allProjects.stream().filter(p -> "RUNNING".equalsIgnoreCase(p.getStatus())).count();
        long completed = allProjects.stream().filter(p -> "COMPLETED".equalsIgnoreCase(p.getStatus())).count();
        long delayed = allProjects.stream()
                .filter(p -> p.getEndDate() != null && p.getEndDate().isBefore(today)
                        && !"COMPLETED".equalsIgnoreCase(p.getStatus()) && !"CANCELLED".equalsIgnoreCase(p.getStatus()))
                .count();

        long todaysTasks = taskRepository.findTasksDueToday(today).size();
        long pendingTasks = taskRepository.countByStatusNot("COMPLETED");

        BigDecimal totalBudget = allProjects.stream().map(Project::getBudget).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalExpenses = allProjects.stream()
                .map(p -> p.getActualCost() != null ? p.getActualCost()
                        : (p.getSpentAmount() != null ? p.getSpentAmount() : BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalProfit = totalBudget.subtract(totalExpenses);

        BigDecimal pendingPayments = invoiceRepository.findAll().stream()
                .filter(inv -> !"PAID".equalsIgnoreCase(inv.getStatus()) && !"CANCELLED".equalsIgnoreCase(inv.getStatus()))
                .map(inv -> inv.getTotalAmount() != null ? inv.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> dashboard = new java.util.LinkedHashMap<>();
        dashboard.put("totalProjects", total);
        dashboard.put("runningProjects", running);
        dashboard.put("completedProjects", completed);
        dashboard.put("delayedProjects", delayed);
        dashboard.put("todaysTasks", todaysTasks);
        dashboard.put("pendingTasks", pendingTasks);
        dashboard.put("budget", totalBudget);
        dashboard.put("expenses", totalExpenses);
        dashboard.put("profit", totalProfit);
        dashboard.put("pendingPayments", pendingPayments);
        return dashboard;
    }

    // =====================================================================
    // Reports
    // =====================================================================

    public List<Map<String, Object>> reportDelayedProjects() {
        java.time.LocalDate today = java.time.LocalDate.now();
        return projectRepository.findAll().stream()
                .filter(p -> p.getEndDate() != null && p.getEndDate().isBefore(today)
                        && !"COMPLETED".equalsIgnoreCase(p.getStatus()) && !"CANCELLED".equalsIgnoreCase(p.getStatus()))
                .map(p -> {
                    Map<String, Object> row = new java.util.LinkedHashMap<>();
                    row.put("projectId", p.getId());
                    row.put("projectCode", p.getProjectCode());
                    row.put("projectName", p.getProjectName());
                    row.put("expectedEndDate", p.getEndDate());
                    row.put("daysDelayed", java.time.temporal.ChronoUnit.DAYS.between(p.getEndDate(), today));
                    row.put("status", p.getStatus());
                    return row;
                }).toList();
    }

    public List<Map<String, Object>> reportBudgetVsActual() {
        return projectRepository.findAll().stream().map(p -> {
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            BigDecimal budget = p.getBudget() != null ? p.getBudget() : BigDecimal.ZERO;
            BigDecimal actual = p.getActualCost() != null ? p.getActualCost()
                    : (p.getSpentAmount() != null ? p.getSpentAmount() : BigDecimal.ZERO);
            row.put("projectId", p.getId());
            row.put("projectName", p.getProjectName());
            row.put("budget", budget);
            row.put("actualCost", actual);
            row.put("variance", budget.subtract(actual));
            return row;
        }).toList();
    }

    public List<Map<String, Object>> reportProfitAnalysis() {
        return projectRepository.findAll().stream().map(p -> {
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("projectId", p.getId());
            row.put("projectName", p.getProjectName());
            row.put("budget", p.getBudget());
            row.put("profit", p.getProfit());
            return row;
        }).toList();
    }

    public List<Map<String, Object>> reportMaterialConsumption(Long projectId) {
        List<ProjectMaterialRequirement> materials = projectId != null
                ? materialRequirementRepository.findByProjectIdOrderByIdAsc(projectId)
                : materialRequirementRepository.findAll();
        return materials.stream().map(m -> {
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("projectId", m.getProject().getId());
            row.put("productName", m.getProduct() != null ? m.getProduct().getName() : null);
            row.put("requiredQty", m.getRequiredQty());
            row.put("issuedQty", m.getIssuedQty());
            row.put("consumedQty", m.getConsumedQty());
            row.put("remainingQty", m.getRemainingQty());
            return row;
        }).toList();
    }

    public List<Map<String, Object>> reportLabourCost() {
        return contractorProjectRepository.findAll().stream().map(cp -> {
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("projectId", cp.getProject().getId());
            row.put("projectName", cp.getProject().getProjectName());
            row.put("contractorName", cp.getContractor().getName());
            row.put("dailyRate", cp.getContractor().getDailyRate());
            row.put("status", cp.getStatus());
            return row;
        }).toList();
    }

    public List<Map<String, Object>> reportEmployeePerformance() {
        return projectTeamRepository.findAll().stream()
                .collect(java.util.stream.Collectors.groupingBy(ProjectTeam::getEmployee))
                .entrySet().stream().map(e -> {
                    Map<String, Object> row = new java.util.LinkedHashMap<>();
                    row.put("employeeId", e.getKey().getId());
                    row.put("employeeName", e.getKey().getName());
                    row.put("assignedProjects", e.getValue().size());
                    return row;
                }).toList();
    }

    public List<Map<String, Object>> reportContractorPerformance() {
        return contractorRepository.findAll().stream().map(c -> {
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("contractorId", c.getId());
            row.put("contractorName", c.getName());
            row.put("performanceRating", c.getPerformanceRating());
            row.put("assignedProjects", contractorProjectRepository.findByContractorId(c.getId()).size());
            return row;
        }).toList();
    }

    // =====================================================================
    // Generate phases / rooms / tasks / materials from the linked BOQ
    // =====================================================================

    public Map<String, Object> generateFromBoq(Long projectId) {
        return reconcileProjectWithBoq(projectId, null);
    }

    /**
     * Safely re-runnable reconciliation between a Project and its currently-linked BOQ (whichever
     * revision {@code project.getBoq()} points at). Replaces the old one-way, non-idempotent
     * generate-from-BOQ logic: phases/rooms/items/tasks are now updated (not just created once),
     * disabled BOQ phases/items cancel their tasks and release reserved material instead of being
     * silently ignored, and material requirements are recomputed from scratch each run instead of
     * being additively incremented (which used to double-count on a second run).
     */
    @Transactional
    public Map<String, Object> reconcileProjectWithBoq(Long projectId, User user) {
        Project project = getProjectById(projectId);
        Boq boq = project.getBoq();
        if (boq == null) {
            throw new IllegalStateException("This project has no BOQ linked yet — link one before generating phases/rooms/tasks.");
        }
        Counters counters = new Counters();

        List<BoqItem> allItems = boqItemRepository.findByBoqId(boq.getId());
        List<BoqPhase> boqPhases = boqPhaseRepository.findByBoqIdOrderBySequenceAsc(boq.getId());
        for (BoqPhase boqPhase : boqPhases) {
            List<BoqItem> items = allItems.stream()
                    .filter(i -> i.getPhase() != null && i.getPhase().getId().equals(boqPhase.getId()))
                    .toList();
            reconcilePhaseBucket(project, boqPhase, items, counters);
        }
        // Items with no BOQ phase — the norm for measurement-generated BOQs, which carry floor/room
        // structure but no phases. Bucketed under a default project phase so generation still
        // produces rooms/tasks/materials instead of silently doing nothing.
        List<BoqItem> unphased = allItems.stream().filter(i -> i.getPhase() == null).toList();
        if (!unphased.isEmpty()) {
            reconcilePhaseBucket(project, null, unphased, counters);
        }

        // Newly generated items start at 0% — recompute every room so stale room/phase/project
        // percentages settle to the real rollup (a full pass here, incremental everywhere else).
        for (ProjectRoom room : roomRepository.findByPhaseProjectId(projectId)) {
            recalcRoom(room);
        }

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("phasesCreated", counters.phasesCreated);
        result.put("roomsCreated", counters.roomsCreated);
        result.put("tasksCreated", counters.tasksCreated);
        result.put("tasksCancelled", counters.tasksCancelled);
        result.put("tasksReactivated", counters.tasksReactivated);
        result.put("materialsCreated", counters.materialsCreated);
        result.put("materialsReleased", counters.materialsReleased);
        return result;
    }

    /** Name of the auto-created project phase that holds BOQ items not assigned to any BOQ phase. */
    private static final String DEFAULT_PHASE_NAME = "General Works";

    private static class Counters {
        int phasesCreated, roomsCreated, tasksCreated, tasksCancelled, tasksReactivated, materialsCreated, materialsReleased;
    }

    /** Reconciles one phase bucket: a real BoqPhase, or (boqPhase == null) the default bucket for unphased items. */
    private void reconcilePhaseBucket(Project project, BoqPhase boqPhase, List<BoqItem> items, Counters counters) {
        ProjectPhase phase;
        boolean phaseActive;
        if (boqPhase != null) {
            phase = phaseRepository.findByProjectIdAndBoqPhaseId(project.getId(), boqPhase.getId()).orElse(null);
            if (phase == null) {
                phase = new ProjectPhase();
                phase.setProject(project);
                phase.setBoqPhaseId(boqPhase.getId());
                phase.setStatus("PLANNING");
                counters.phasesCreated++;
            }
            phase.setName(boqPhase.getPhaseName());
            phase.setSequence(boqPhase.getSequence());
            phase.setBudget(boqPhase.getBudget());
            phaseActive = !Boolean.FALSE.equals(boqPhase.getIsActive());
        } else {
            phase = phaseRepository.findByProjectIdOrderBySequenceAsc(project.getId()).stream()
                    .filter(p -> p.getBoqPhaseId() == null && DEFAULT_PHASE_NAME.equals(p.getName()))
                    .findFirst().orElse(null);
            if (phase == null) {
                phase = new ProjectPhase();
                phase.setProject(project);
                phase.setName(DEFAULT_PHASE_NAME);
                phase.setSequence(0);
                phase.setStatus("PLANNING");
                counters.phasesCreated++;
            }
            phaseActive = true;
        }
        phase = phaseRepository.save(phase);

            // Recompute this phase's material requirements from scratch (replace, not add) so re-running is idempotent.
            Map<Long, BigDecimal> requiredByProduct = new java.util.LinkedHashMap<>();
            Map<Long, String> unitByProduct = new java.util.LinkedHashMap<>();
            Map<Long, Product> productByProductId = new java.util.LinkedHashMap<>();

            for (BoqItem boqItem : items) {
                boolean itemActive = phaseActive && !Boolean.FALSE.equals(boqItem.getIsActive());

                if (!itemActive) {
                    Task existingTask = taskRepository.findByGeneratedFromBoqItemId(boqItem.getId()).orElse(null);
                    if (existingTask != null && !"CANCELLED".equals(existingTask.getStatus())) {
                        existingTask.setStatus("CANCELLED");
                        taskRepository.save(existingTask);
                        counters.tasksCancelled++;
                        if (existingTask.getAssignedEmployee() != null) {
                            notificationService.dispatch("Task Cancelled",
                                    "\"" + existingTask.getTaskName() + "\" was cancelled following a BOQ scope change.",
                                    "TASK", existingTask.getAssignedEmployee().getId(), "/tasks/" + existingTask.getId());
                        }
                    }
                    continue;
                }

                String roomName = boqItem.getRoomName() != null ? boqItem.getRoomName() : "General";
                ProjectRoom room = roomRepository.findByPhaseIdAndRoomName(phase.getId(), roomName).orElse(null);
                if (room == null) {
                    room = new ProjectRoom();
                    room.setPhase(phase);
                    room.setRoomName(roomName);
                    room.setFloorName(boqItem.getFloorName());
                    counters.roomsCreated++;
                }
                // Room type ("Bedroom", "Kitchen") only exists on the measurement — carry it through so
                // the project's phase → room tree matches what was measured on site. Set on every run so
                // rooms created before this existed get filled in too.
                if (room.getRoomType() == null && boqItem.getMeasurementRoomId() != null) {
                    MeasurementRoom source = measurementRoomRepository
                            .findById(boqItem.getMeasurementRoomId()).orElse(null);
                    if (source != null) {
                        room.setRoomType(source.getRoomType());
                    }
                }
                if (room.getFloorName() == null) {
                    room.setFloorName(boqItem.getFloorName());
                }
                room = roomRepository.save(room);

                ProjectRoomItem roomItem = roomItemRepository.findByRoomIdAndBoqItemId(room.getId(), boqItem.getId()).orElse(null);
                if (roomItem == null) {
                    roomItem = new ProjectRoomItem();
                    roomItem.setRoom(room);
                    roomItem.setBoqItemId(boqItem.getId());
                }
                roomItem.setItemType(boqItem.getCategory() != null ? boqItem.getCategory().toUpperCase() : "CUSTOM");
                roomItem.setItemName(boqItem.getItemName());
                roomItem.setDescription(boqItem.getDescription());
                roomItem.setQuantity(boqItem.getQuantity());
                roomItem.setUnit(boqItem.getUnit());
                roomItemRepository.save(roomItem);

                Task task = taskRepository.findByGeneratedFromBoqItemId(boqItem.getId()).orElse(null);
                if (task == null) {
                    task = new Task();
                    task.setProject(project);
                    task.setPhase(phase);
                    task.setRoom(room);
                    task.setTaskName(boqItem.getItemName());
                    task.setDescription(boqItem.getDescription());
                    task.setPriority("MEDIUM");
                    task.setStatus("PENDING");
                    task.setGeneratedFromBoqItemId(boqItem.getId());
                    taskRepository.save(task);
                    taskChecklistService.ensureDefaultChecklist(task);
                    counters.tasksCreated++;
                } else {
                    task.setTaskName(boqItem.getItemName());
                    task.setDescription(boqItem.getDescription());
                    if ("CANCELLED".equals(task.getStatus())) {
                        task.setStatus("PENDING");
                        counters.tasksReactivated++;
                        if (task.getAssignedEmployee() != null) {
                            notificationService.dispatch("Task Reactivated",
                                    "\"" + task.getTaskName() + "\" is back in scope following a BOQ change.",
                                    "TASK", task.getAssignedEmployee().getId(), "/tasks/" + task.getId());
                        }
                    }
                    taskRepository.save(task);
                }

                for (BoqItemMaterial material : boqItemMaterialRepository.findByItemId(boqItem.getId())) {
                    if (material.getProduct() == null) continue;
                    BigDecimal qty = material.getFinalQuantity() != null ? material.getFinalQuantity() : BigDecimal.ZERO;
                    requiredByProduct.merge(material.getProduct().getId(), qty, BigDecimal::add);
                    unitByProduct.putIfAbsent(material.getProduct().getId(), material.getUnit());
                    productByProductId.putIfAbsent(material.getProduct().getId(), material.getProduct());
                }
            }

            // Replace each requirement's requiredQty with the freshly-recomputed sum (not additive), and
            // release any now-unneeded reservation when a requirement drops to zero. The default bucket
            // also adopts project-level (phase-less) rows — e.g. the material list inherited from an
            // approved quotation at conversion — instead of duplicating them per product.
            ProjectPhase finalPhase = phase;
            boolean defaultBucket = boqPhase == null;
            List<ProjectMaterialRequirement> existingRequirements = materialRequirementRepository.findByProjectIdOrderByIdAsc(project.getId()).stream()
                    .filter(r -> (r.getPhase() != null && r.getPhase().getId().equals(finalPhase.getId()))
                            || (defaultBucket && r.getPhase() == null))
                    .toList();
            for (ProjectMaterialRequirement requirement : existingRequirements) {
                requirement.setPhase(finalPhase);
                Long productId = requirement.getProduct().getId();
                BigDecimal previousRequired = requirement.getRequiredQty() != null ? requirement.getRequiredQty() : BigDecimal.ZERO;
                BigDecimal newRequired = requiredByProduct.remove(productId);
                if (newRequired == null) newRequired = BigDecimal.ZERO;
                requirement.setRequiredQty(newRequired);
                if (newRequired.compareTo(BigDecimal.ZERO) == 0 && requirement.getReservedQty() != null
                        && requirement.getReservedQty().compareTo(BigDecimal.ZERO) > 0) {
                    inventoryService.releaseReservation(productId, requirement.getReservedQty().intValue(),
                            "PROJECT_MATERIAL_REQUIREMENT", requirement.getId());
                    requirement.setReservedQty(BigDecimal.ZERO);
                    requirement.setRemarks("No longer required (BOQ change) — reservation released.");
                    counters.materialsReleased++;
                } else if (newRequired.compareTo(previousRequired) > 0) {
                    // Scope increased (e.g. a phase was reactivated) — best-effort reserve the delta;
                    // a missing warehouse/stock shortage shouldn't fail the whole reconciliation.
                    try {
                        inventoryService.reserveStock(productId, newRequired.subtract(previousRequired).intValue(),
                                "PROJECT_MATERIAL_REQUIREMENT", requirement.getId());
                    } catch (Exception ignored) {
                        requirement.setRemarks("Additional stock could not be auto-reserved — check availability.");
                    }
                }
                materialRequirementRepository.save(requirement);
            }
            for (Map.Entry<Long, BigDecimal> entry : requiredByProduct.entrySet()) {
                ProjectMaterialRequirement requirement = new ProjectMaterialRequirement();
                requirement.setProject(project);
                requirement.setPhase(finalPhase);
                requirement.setProduct(productByProductId.get(entry.getKey()));
                requirement.setRequiredQty(entry.getValue());
                requirement.setUnit(unitByProduct.get(entry.getKey()));
                materialRequirementRepository.save(requirement);
                counters.materialsCreated++;
            }
    }

    public Map<String, Object> getCommandCenterStats(Long projectId) {
        Project project = getProjectById(projectId);
        
        List<Task> allTasks = taskRepository.findByProjectId(projectId);
        long pendingTasks = allTasks.stream().filter(t -> "PENDING".equalsIgnoreCase(t.getStatus())).count();
        long inProgressTasks = allTasks.stream().filter(t -> "IN_PROGRESS".equalsIgnoreCase(t.getStatus())).count();
        long completedTasks = allTasks.stream().filter(t -> "COMPLETED".equalsIgnoreCase(t.getStatus())).count();
        long delayedTasks = allTasks.stream().filter(t -> t.getDueDate() != null && t.getDueDate().isBefore(java.time.LocalDate.now()) && !"COMPLETED".equalsIgnoreCase(t.getStatus())).count();
        
        List<ProjectIssue> issues = issueRepository.findByProjectId(projectId);
        long openIssues = issues.stream().filter(i -> !"CLOSED".equalsIgnoreCase(i.getStatus())).count();
        long criticalIssues = issues.stream().filter(i -> "CRITICAL".equalsIgnoreCase(i.getPriority()) && !"CLOSED".equalsIgnoreCase(i.getStatus())).count();
        
        List<ProjectCustomerApproval> approvals = approvalRepository.findByProjectId(projectId);
        long pendingApprovals = approvals.stream().filter(a -> "PENDING".equalsIgnoreCase(a.getStatus())).count();
        
        java.time.LocalDate today = java.time.LocalDate.now();
        List<ProjectDailyLogEmployee> liveEmployees = new java.util.ArrayList<>();
        List<ProjectDailyLog> dailyLogs = dailyLogRepository.findByProjectIdOrderByLogDateDesc(projectId);
        for (ProjectDailyLog log : dailyLogs) {
            if (log.getLogDate() != null && log.getLogDate().equals(today)) {
                liveEmployees.addAll(dailyLogEmployeeRepository.findByDailyLogId(log.getId()));
            }
        }
        
        List<ProjectTeam> teamMembers = projectTeamRepository.findByProjectId(projectId);
        List<ProjectMaterialRequirement> materials = materialRequirementRepository.findByProjectIdOrderByIdAsc(projectId);
        
        List<SiteVisit> visitsToday = siteVisitRepository.findByProjectIdAndIsDeletedFalseOrderByScheduledDateDesc(projectId).stream()
                .filter(v -> v.getScheduledDate() != null && v.getScheduledDate().isEqual(today))
                .toList();

        String health = "EXCELLENT";
        if (criticalIssues > 0 || delayedTasks > 5) {
            health = "CRITICAL";
        } else if (openIssues > 3 || delayedTasks > 0) {
            health = "WARNING";
        } else if (openIssues > 0) {
            health = "GOOD";
        }

        Map<String, Object> stats = new java.util.LinkedHashMap<>();
        stats.put("project", project);
        stats.put("health", health);
        
        stats.put("tasks", Map.of(
            "total", allTasks.size(),
            "pending", pendingTasks,
            "inProgress", inProgressTasks,
            "completed", completedTasks,
            "delayed", delayedTasks
        ));
        
        stats.put("issues", Map.of(
            "total", issues.size(),
            "open", openIssues,
            "critical", criticalIssues
        ));
        
        stats.put("approvals", Map.of(
            "total", approvals.size(),
            "pending", pendingApprovals
        ));
        
        stats.put("todayManpower", liveEmployees.size());
        stats.put("teamMembers", teamMembers);
        stats.put("pendingMaterials", materials.stream().filter(m -> 
            m.getRequiredQty() != null && (m.getIssuedQty() == null || m.getRequiredQty().compareTo(m.getIssuedQty()) > 0)
        ).count());
        stats.put("siteVisitsToday", visitsToday.size());
        
        return stats;
    }
}
