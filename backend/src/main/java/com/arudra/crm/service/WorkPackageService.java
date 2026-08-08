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
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Work Package lifecycle — the spine of contractor management.
 *
 * <p>A package is always created inside a project (never standalone) and carries the BOQ items
 * it covers. Contractors reach work only through {@link WorkPackageAssignment}; accepting an
 * assignment starts execution, and verified daily progress rolls completion up to the package,
 * its phase and the project.
 */
@Service
public class WorkPackageService {

    /** Package states from which execution/billing activity is allowed. */
    private static final Set<String> LIVE_STATUSES = Set.of(
            "ACCEPTED", "IN_PROGRESS", "ON_HOLD", "WORK_COMPLETED", "INSPECTION_PENDING", "REWORK");

    /** Roles notified when a package is delayed or needs attention. */
    static final List<String> CONTRACTOR_ALERT_ROLES =
            List.of("ROLE_ADMIN", "ROLE_MANAGER", "ROLE_PROJECT_MANAGER");

    /**
     * BOQ category → contractor trade. Categories come from BoqItem.category, which the BOQ
     * module writes as free text, so lookup is case-insensitive with a keyword fallback.
     */
    private static final Map<String, String> CATEGORY_TO_TRADE = Map.ofEntries(
            Map.entry("carpentry", "CARPENTRY"),
            Map.entry("wardrobe", "CARPENTRY"),
            Map.entry("modular kitchen", "FURNITURE"),
            Map.entry("furniture", "FURNITURE"),
            Map.entry("false ceiling", "FALSE_CEILING"),
            Map.entry("painting", "PAINTING"),
            Map.entry("electrical", "ELECTRICAL"),
            Map.entry("plumbing", "PLUMBING"),
            Map.entry("flooring", "TILES"),
            Map.entry("glass", "GLASS"),
            Map.entry("aluminium", "ALUMINIUM"),
            Map.entry("civil", "CIVIL"),
            Map.entry("hardware", "FABRICATION"),
            Map.entry("hvac", "HVAC"));

    @Autowired private ContractorWorkPackageRepository packageRepository;
    @Autowired private WorkPackageItemRepository itemRepository;
    @Autowired private WorkPackageAssignmentRepository assignmentRepository;
    @Autowired private WorkPackageChangeRepository changeRepository;
    @Autowired private ContractorRepository contractorRepository;
    @Autowired private ContractorProjectRepository contractorProjectRepository;
    @Autowired private ContractorDailyProgressRepository progressRepository;
    @Autowired private ContractorBillRepository billRepository;
    @Autowired private ContractorPaymentRepository paymentRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectPhaseRepository phaseRepository;
    @Autowired private ProjectRoomRepository roomRepository;
    @Autowired private ProjectRoomItemRepository roomItemRepository;
    @Autowired private BoqRepository boqRepository;
    @Autowired private BoqItemRepository boqItemRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private ContractorService contractorService;

    // =====================================================================
    // Queries
    // =====================================================================

    public Page<ContractorWorkPackage> search(Long projectId, Long phaseId, Long roomId, Long contractorId,
                                              String trade, String status, String search, int page, int size) {
        return packageRepository.search(projectId, phaseId, roomId, contractorId,
                blankToNull(trade), blankToNull(status), blankToNull(search),
                PageRequest.of(page, size, Sort.by("id").descending()));
    }

    public ContractorWorkPackage getWorkPackage(Long id) {
        return packageRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Work package not found: " + id));
    }

    public List<ContractorWorkPackage> getByProject(Long projectId) {
        return packageRepository.findByProjectIdOrderByIdDesc(projectId);
    }

    public List<WorkPackageItem> getItems(Long workPackageId) {
        return itemRepository.findByWorkPackageIdOrderByIdAsc(workPackageId);
    }

    public List<WorkPackageAssignment> getAssignments(Long workPackageId) {
        return assignmentRepository.findByWorkPackageIdOrderByIdAsc(workPackageId);
    }

    /** Full package view for the detail page — one round trip instead of six. */
    public Map<String, Object> getWorkPackageDetail(Long id) {
        ContractorWorkPackage wp = getWorkPackage(id);
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("workPackage", wp);
        detail.put("items", itemRepository.findByWorkPackageIdOrderByIdAsc(id));
        detail.put("assignments", assignmentRepository.findByWorkPackageIdOrderByIdAsc(id));
        detail.put("progress", progressRepository.findByWorkPackageIdOrderByProgressDateDesc(id));
        detail.put("bills", billRepository.findByWorkPackageIdOrderByIdDesc(id));
        detail.put("changes", changeRepository.findByWorkPackageIdOrderByIdDesc(id));
        detail.put("materialRecovery", BigDecimal.ZERO);
        return detail;
    }

    // =====================================================================
    // Create / update
    // =====================================================================

    /**
     * @param boqItemIds optional BOQ items to pull into the package at creation time.
     */
    @Transactional
    public ContractorWorkPackage createWorkPackage(ContractorWorkPackage payload, Long projectId, Long phaseId,
                                                   Long roomId, Long boqId, List<Long> boqItemIds, User currentUser) {
        if (projectId == null) {
            throw new IllegalArgumentException(
                    "A work package must belong to a project — contractors are never assigned a project directly.");
        }
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));

        ContractorWorkPackage wp = new ContractorWorkPackage();
        wp.setProject(project);
        applyEditableFields(wp, payload);
        resolveScope(wp, phaseId, roomId, boqId, project);
        wp.setCreatedByUser(currentUser);
        wp.setStatus(payload.getStatus() == null ? "DRAFT" : payload.getStatus());
        if (wp.getRetentionPercentage() == null) {
            wp.setRetentionPercentage(BigDecimal.valueOf(5));
        }
        wp = packageRepository.save(wp);
        wp.setPackageCode(nextPackageCode(wp.getId()));
        wp = packageRepository.save(wp);

        if (boqItemIds != null && !boqItemIds.isEmpty()) {
            addBoqItems(wp.getId(), boqItemIds);
            wp = getWorkPackage(wp.getId());
        }
        return wp;
    }

    @Transactional
    public ContractorWorkPackage updateWorkPackage(Long id, ContractorWorkPackage payload,
                                                   Long phaseId, Long roomId, Long boqId) {
        ContractorWorkPackage wp = getWorkPackage(id);
        if ("COMPLETED".equals(wp.getStatus()) || "CANCELLED".equals(wp.getStatus())) {
            throw new IllegalStateException("A " + wp.getStatus() + " work package can no longer be edited.");
        }
        applyEditableFields(wp, payload);
        resolveScope(wp, phaseId, roomId, boqId, wp.getProject());
        return packageRepository.save(wp);
    }

    private void applyEditableFields(ContractorWorkPackage wp, ContractorWorkPackage payload) {
        if (payload.getPackageName() != null) wp.setPackageName(payload.getPackageName());
        if (payload.getDescription() != null) wp.setDescription(payload.getDescription());
        if (payload.getTrade() != null) wp.setTrade(payload.getTrade());
        if (payload.getPriority() != null) wp.setPriority(payload.getPriority());
        if (payload.getRateType() != null) wp.setRateType(payload.getRateType());
        if (payload.getRate() != null) wp.setRate(payload.getRate());
        if (payload.getQuantity() != null) wp.setQuantity(payload.getQuantity());
        if (payload.getUnit() != null) wp.setUnit(payload.getUnit());
        if (payload.getEstimatedCost() != null) wp.setEstimatedCost(payload.getEstimatedCost());
        if (payload.getStartDate() != null) wp.setStartDate(payload.getStartDate());
        if (payload.getEndDate() != null) wp.setEndDate(payload.getEndDate());
        if (payload.getRetentionPercentage() != null) wp.setRetentionPercentage(payload.getRetentionPercentage());
        if (payload.getScopeOfWork() != null) wp.setScopeOfWork(payload.getScopeOfWork());
        if (payload.getTerms() != null) wp.setTerms(payload.getTerms());
        if (payload.getRemarks() != null) wp.setRemarks(payload.getRemarks());
        if (payload.getSiteEngineer() != null && payload.getSiteEngineer().getId() != null) {
            wp.setSiteEngineer(userRepository.findById(payload.getSiteEngineer().getId()).orElse(null));
        }
        // A rate-driven package derives its estimate from rate x quantity unless one was supplied.
        if (wp.getRate() != null && wp.getQuantity() != null
                && (payload.getEstimatedCost() == null || payload.getEstimatedCost().signum() == 0)) {
            wp.setEstimatedCost(wp.getRate().multiply(wp.getQuantity()).setScale(2, RoundingMode.HALF_UP));
        }
    }

    private void resolveScope(ContractorWorkPackage wp, Long phaseId, Long roomId, Long boqId, Project project) {
        if (phaseId != null) {
            ProjectPhase phase = phaseRepository.findById(phaseId)
                    .orElseThrow(() -> new IllegalArgumentException("Project phase not found: " + phaseId));
            if (!phase.getProject().getId().equals(project.getId())) {
                throw new IllegalArgumentException("Phase " + phaseId + " does not belong to project " + project.getId());
            }
            wp.setPhase(phase);
        }
        if (roomId != null) {
            ProjectRoom room = roomRepository.findById(roomId)
                    .orElseThrow(() -> new IllegalArgumentException("Project room not found: " + roomId));
            wp.setRoom(room);
            if (wp.getPhase() == null) wp.setPhase(room.getPhase());
        }
        if (boqId != null) {
            wp.setBoq(boqRepository.findById(boqId).orElse(null));
        } else if (wp.getBoq() == null && project.getBoq() != null) {
            wp.setBoq(project.getBoq());
        }
    }

    // =====================================================================
    // BOQ linkage
    // =====================================================================

    /**
     * Pulls BOQ items into the package. A BOQ item can only sit in one live package —
     * that guard is what stops the same scope being paid to two contractors.
     */
    @Transactional
    public List<WorkPackageItem> addBoqItems(Long workPackageId, List<Long> boqItemIds) {
        ContractorWorkPackage wp = getWorkPackage(workPackageId);
        List<WorkPackageItem> created = new ArrayList<>();

        for (Long boqItemId : boqItemIds) {
            if (itemRepository.findFirstByWorkPackageIdAndBoqItemId(workPackageId, boqItemId).isPresent()) {
                continue; // already linked — keep the call idempotent
            }
            BoqItem boqItem = boqItemRepository.findById(boqItemId)
                    .orElseThrow(() -> new IllegalArgumentException("BOQ item not found: " + boqItemId));

            List<WorkPackageItem> existing = itemRepository.findLiveAllocationsForBoqItem(boqItemId);
            if (!existing.isEmpty()) {
                throw new IllegalStateException("BOQ item \"" + boqItem.getItemName()
                        + "\" is already allocated to work package "
                        + existing.get(0).getWorkPackage().getPackageCode() + ".");
            }

            WorkPackageItem item = new WorkPackageItem();
            item.setWorkPackage(wp);
            item.setBoqItem(boqItem);
            item.setItemName(boqItem.getItemName());
            item.setDescription(boqItem.getDescription());
            item.setUnit(boqItem.getUnit());
            item.setQuantity(boqItem.getQuantity() == null ? BigDecimal.ONE : boqItem.getQuantity());
            // Contractor pay defaults to the BOQ's labour component — materials are issued from store,
            // so paying the full BOQ amount would double-charge the project.
            BigDecimal labour = boqItem.getLabourTotal() == null ? BigDecimal.ZERO : boqItem.getLabourTotal();
            item.setAmount(labour);
            if (item.getQuantity().signum() != 0) {
                item.setRate(labour.divide(item.getQuantity(), 2, RoundingMode.HALF_UP));
            }
            linkExecutionArtifacts(item, boqItem, wp);
            created.add(itemRepository.save(item));
        }

        recomputeEstimate(wp);
        return created;
    }

    /** Adds a free-text line (extra work not present in the BOQ). */
    @Transactional
    public WorkPackageItem addManualItem(Long workPackageId, WorkPackageItem payload) {
        ContractorWorkPackage wp = getWorkPackage(workPackageId);
        WorkPackageItem item = new WorkPackageItem();
        item.setWorkPackage(wp);
        item.setItemName(payload.getItemName());
        item.setDescription(payload.getDescription());
        item.setUnit(payload.getUnit());
        item.setQuantity(payload.getQuantity() == null ? BigDecimal.ONE : payload.getQuantity());
        item.setRate(payload.getRate());
        // amount defaults to ZERO on the entity, so a caller that omits it arrives as zero rather
        // than null — treat zero as "not supplied" and derive it from rate x quantity.
        item.setAmount(nz(payload.getAmount()).signum() > 0 ? payload.getAmount()
                : nz(payload.getRate()).multiply(item.getQuantity()).setScale(2, RoundingMode.HALF_UP));
        item.setRemarks(payload.getRemarks());
        item = itemRepository.save(item);
        recomputeEstimate(wp);
        return item;
    }

    @Transactional
    public WorkPackageItem updateItem(Long itemId, WorkPackageItem payload) {
        WorkPackageItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Work package item not found: " + itemId));
        if (payload.getItemName() != null) item.setItemName(payload.getItemName());
        if (payload.getDescription() != null) item.setDescription(payload.getDescription());
        if (payload.getUnit() != null) item.setUnit(payload.getUnit());
        if (payload.getQuantity() != null) item.setQuantity(payload.getQuantity());
        if (payload.getRate() != null) item.setRate(payload.getRate());
        if (payload.getCompletedQuantity() != null) item.setCompletedQuantity(payload.getCompletedQuantity());
        if (payload.getStatus() != null) item.setStatus(payload.getStatus());
        if (payload.getRemarks() != null) item.setRemarks(payload.getRemarks());
        item.setAmount(nz(item.getRate()).multiply(nz(item.getQuantity())).setScale(2, RoundingMode.HALF_UP));
        item = itemRepository.save(item);
        recomputeEstimate(item.getWorkPackage());
        return item;
    }

    @Transactional
    public void removeItem(Long itemId) {
        WorkPackageItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Work package item not found: " + itemId));
        ContractorWorkPackage wp = item.getWorkPackage();
        itemRepository.delete(item);
        recomputeEstimate(wp);
    }

    /**
     * Ties the package line to the project's own execution records so contractor work shows up
     * on the project board and room checklist, not only inside the contractor module.
     */
    private void linkExecutionArtifacts(WorkPackageItem item, BoqItem boqItem, ContractorWorkPackage wp) {
        taskRepository.findByGeneratedFromBoqItemId(boqItem.getId()).ifPresent(item::setTask);
        if (wp.getRoom() != null) {
            roomItemRepository.findByRoomIdAndBoqItemId(wp.getRoom().getId(), boqItem.getId())
                    .ifPresent(item::setProjectRoomItem);
        }
    }

    // =====================================================================
    // Assignment
    // =====================================================================

    /** Assigns a contractor. Repeat calls for the same contractor update the existing assignment. */
    @Transactional
    public WorkPackageAssignment assignContractor(Long workPackageId, Long contractorId,
                                                  WorkPackageAssignment payload, User currentUser) {
        ContractorWorkPackage wp = getWorkPackage(workPackageId);
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));
        if ("BLACKLISTED".equals(contractor.getStatus()) || "INACTIVE".equals(contractor.getStatus())) {
            throw new IllegalStateException("Contractor " + contractor.getName()
                    + " is " + contractor.getStatus() + " and cannot be assigned work.");
        }

        WorkPackageAssignment assignment = assignmentRepository
                .findFirstByWorkPackageIdAndContractorId(workPackageId, contractorId)
                .orElseGet(WorkPackageAssignment::new);
        boolean isNew = assignment.getId() == null;

        assignment.setWorkPackage(wp);
        assignment.setContractor(contractor);
        assignment.setRole(payload.getRole() != null ? payload.getRole() : "LEAD");
        assignment.setScopeShare(payload.getScopeShare());
        assignment.setRateType(payload.getRateType() != null ? payload.getRateType() : wp.getRateType());
        assignment.setRate(payload.getRate() != null ? payload.getRate() : wp.getRate());
        assignment.setAgreedAmount(payload.getAgreedAmount() != null ? payload.getAgreedAmount() : wp.getEstimatedCost());
        assignment.setStartDate(payload.getStartDate() != null ? payload.getStartDate() : wp.getStartDate());
        assignment.setEndDate(payload.getEndDate() != null ? payload.getEndDate() : wp.getEndDate());
        assignment.setRemarks(payload.getRemarks());
        assignment.setAssignedBy(currentUser);
        assignment.setAssignedAt(LocalDateTime.now());
        assignment.setStatus("ASSIGNED");
        assignment = assignmentRepository.save(assignment);

        if (isNew) {
            contractor.setTotalWorkPackages(nz(contractor.getTotalWorkPackages()) + 1);
            contractorRepository.save(contractor);
            ensureContractorProjectLink(contractor, wp);
        }

        if ("DRAFT".equals(wp.getStatus()) || "PENDING_ASSIGNMENT".equals(wp.getStatus())) {
            wp.setStatus("ASSIGNED");
        }
        recomputeFinancials(wp);
        notifyContractor(contractor, "New work assigned",
                "Work package " + wp.getPackageCode() + " — " + wp.getPackageName() + " has been assigned to you.",
                "/contractors/work-packages/" + wp.getId());
        return assignment;
    }

    /** Contractor (or a PM acting for them) accepts the assignment; execution may now begin. */
    @Transactional
    public WorkPackageAssignment acceptAssignment(Long assignmentId, String remarks) {
        WorkPackageAssignment assignment = getAssignment(assignmentId);
        if (!"ASSIGNED".equals(assignment.getStatus())) {
            throw new IllegalStateException("Only an ASSIGNED work package can be accepted (currently "
                    + assignment.getStatus() + ").");
        }
        assignment.setStatus("ACCEPTED");
        assignment.setAcceptedAt(LocalDateTime.now());
        if (remarks != null) assignment.setRemarks(remarks);
        assignment = assignmentRepository.save(assignment);

        ContractorWorkPackage wp = assignment.getWorkPackage();
        if ("ASSIGNED".equals(wp.getStatus())) {
            wp.setStatus("ACCEPTED");
        }
        recomputeFinancials(wp);
        notifyManagers("Work package accepted",
                assignment.getContractor().getName() + " accepted " + wp.getPackageCode() + ".",
                "/contractors/work-packages/" + wp.getId());
        return assignment;
    }

    @Transactional
    public WorkPackageAssignment rejectAssignment(Long assignmentId, String reason) {
        WorkPackageAssignment assignment = getAssignment(assignmentId);
        if (!"ASSIGNED".equals(assignment.getStatus())) {
            throw new IllegalStateException("Only an ASSIGNED work package can be rejected (currently "
                    + assignment.getStatus() + ").");
        }
        assignment.setStatus("REJECTED");
        assignment.setRejectedAt(LocalDateTime.now());
        assignment.setRejectionReason(reason);
        assignment = assignmentRepository.save(assignment);

        ContractorWorkPackage wp = assignment.getWorkPackage();
        boolean anyLive = assignmentRepository.findByWorkPackageIdOrderByIdAsc(wp.getId()).stream()
                .anyMatch(a -> !"REJECTED".equals(a.getStatus()) && !"TERMINATED".equals(a.getStatus()));
        if (!anyLive) {
            wp.setStatus("PENDING_ASSIGNMENT");
            packageRepository.save(wp);
        }
        notifyManagers("Work package rejected",
                assignment.getContractor().getName() + " rejected " + wp.getPackageCode()
                        + (reason != null ? ": " + reason : "."),
                "/contractors/work-packages/" + wp.getId());
        return assignment;
    }

    @Transactional
    public WorkPackageAssignment terminateAssignment(Long assignmentId, String reason) {
        WorkPackageAssignment assignment = getAssignment(assignmentId);
        assignment.setStatus("TERMINATED");
        assignment.setRejectionReason(reason);
        assignment = assignmentRepository.save(assignment);
        recomputeFinancials(assignment.getWorkPackage());
        return assignment;
    }

    public WorkPackageAssignment getAssignment(Long id) {
        return assignmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found: " + id));
    }

    private void ensureContractorProjectLink(Contractor contractor, ContractorWorkPackage wp) {
        contractorProjectRepository.findFirstByContractorIdAndProjectId(contractor.getId(), wp.getProject().getId())
                .orElseGet(() -> {
                    ContractorProject link = new ContractorProject();
                    link.setContractor(contractor);
                    link.setProject(wp.getProject());
                    link.setAssignedDate(LocalDate.now());
                    link.setStatus("ACTIVE");
                    link.setTrade(wp.getTrade());
                    return contractorProjectRepository.save(link);
                });
    }

    // =====================================================================
    // Lifecycle
    // =====================================================================

    @Transactional
    public ContractorWorkPackage startWork(Long id) {
        ContractorWorkPackage wp = getWorkPackage(id);
        if (!"ACCEPTED".equals(wp.getStatus()) && !"ON_HOLD".equals(wp.getStatus()) && !"REWORK".equals(wp.getStatus())) {
            throw new IllegalStateException("Work can only start from ACCEPTED, ON_HOLD or REWORK (currently "
                    + wp.getStatus() + ").");
        }
        wp.setStatus("IN_PROGRESS");
        if (wp.getActualStartDate() == null) wp.setActualStartDate(LocalDate.now());
        assignmentRepository.findByWorkPackageIdOrderByIdAsc(id).stream()
                .filter(a -> "ACCEPTED".equals(a.getStatus()))
                .forEach(a -> {
                    a.setStatus("IN_PROGRESS");
                    assignmentRepository.save(a);
                });
        return packageRepository.save(wp);
    }

    @Transactional
    public ContractorWorkPackage holdWork(Long id, String reason) {
        ContractorWorkPackage wp = getWorkPackage(id);
        wp.setStatus("ON_HOLD");
        wp.setRemarks(reason);
        return packageRepository.save(wp);
    }

    /** Contractor declares the work finished; it now needs a quality inspection before closure. */
    @Transactional
    public ContractorWorkPackage markWorkCompleted(Long id) {
        ContractorWorkPackage wp = getWorkPackage(id);
        if (!LIVE_STATUSES.contains(wp.getStatus())) {
            throw new IllegalStateException("Work package must be in execution to be marked complete (currently "
                    + wp.getStatus() + ").");
        }
        wp.setStatus("INSPECTION_PENDING");
        wp.setCompletionPercentage(100);
        wp.setActualEndDate(LocalDate.now());
        wp = packageRepository.save(wp);
        notifyManagers("Work package ready for inspection",
                wp.getPackageCode() + " — " + wp.getPackageName() + " is awaiting quality inspection.",
                "/contractors/work-packages/" + wp.getId());
        rollUpProgress(wp);
        return wp;
    }

    /**
     * Closes the package. Requires a passed/approved inspection — the quality gate is what
     * protects the final bill from being raised on unverified work.
     */
    @Transactional
    public ContractorWorkPackage completeWorkPackage(Long id) {
        ContractorWorkPackage wp = getWorkPackage(id);
        if (!"APPROVED".equals(wp.getQualityStatus()) && !"PASS".equals(wp.getQualityStatus())) {
            throw new IllegalStateException(
                    "Work package cannot be completed before a quality inspection passes (current quality status: "
                            + (wp.getQualityStatus() == null ? "not inspected" : wp.getQualityStatus()) + ").");
        }
        wp.setStatus("COMPLETED");
        wp.setCompletionPercentage(100);
        if (wp.getActualEndDate() == null) wp.setActualEndDate(LocalDate.now());
        wp = packageRepository.save(wp);

        for (WorkPackageAssignment assignment : assignmentRepository.findByWorkPackageIdOrderByIdAsc(id)) {
            if ("REJECTED".equals(assignment.getStatus()) || "TERMINATED".equals(assignment.getStatus())) continue;
            assignment.setStatus("COMPLETED");
            assignment.setCompletedAt(LocalDateTime.now());
            assignmentRepository.save(assignment);
            Contractor contractor = assignment.getContractor();
            contractor.setCompletedWorkPackages(nz(contractor.getCompletedWorkPackages()) + 1);
            contractorRepository.save(contractor);
            // Delivery performance is measured, not typed in — recompute it from what shipped.
            contractorService.refreshTimelinessRating(contractor.getId());
        }
        for (WorkPackageItem item : itemRepository.findByWorkPackageIdOrderByIdAsc(id)) {
            item.setStatus("COMPLETED");
            itemRepository.save(item);
        }
        rollUpProgress(wp);
        return wp;
    }

    @Transactional
    public ContractorWorkPackage cancelWorkPackage(Long id, String reason) {
        ContractorWorkPackage wp = getWorkPackage(id);
        BigDecimal billed = billRepository.sumNetByWorkPackage(id);
        if (billed != null && billed.signum() > 0) {
            throw new IllegalStateException("Work package has billed value of " + billed
                    + " and cannot be cancelled — raise a reduced-scope change instead.");
        }
        wp.setStatus("CANCELLED");
        wp.setRemarks(reason);
        return packageRepository.save(wp);
    }

    // =====================================================================
    // Progress roll-up
    // =====================================================================

    /**
     * Recomputes package completion from verified daily progress, then pushes the result up
     * to the phase and project so contractor work moves the same progress bars employee work does.
     */
    @Transactional
    public ContractorWorkPackage recomputeCompletion(Long workPackageId) {
        ContractorWorkPackage wp = getWorkPackage(workPackageId);
        Integer verified = progressRepository.maxVerifiedCompletion(workPackageId);
        int pct = verified == null ? 0 : verified;

        // A package with measurable items prefers the quantity-weighted view over the reported figure.
        List<WorkPackageItem> items = itemRepository.findByWorkPackageIdOrderByIdAsc(workPackageId);
        BigDecimal totalQty = items.stream().map(WorkPackageItem::getQuantity)
                .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalQty.signum() > 0) {
            BigDecimal doneQty = items.stream().map(WorkPackageItem::getCompletedQuantity)
                    .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
            int qtyPct = doneQty.multiply(BigDecimal.valueOf(100))
                    .divide(totalQty, 0, RoundingMode.HALF_UP).intValue();
            pct = Math.max(pct, Math.min(qtyPct, 100));
        }

        wp.setCompletionPercentage(Math.min(pct, 100));
        if (pct > 0 && "ACCEPTED".equals(wp.getStatus())) {
            wp.setStatus("IN_PROGRESS");
            if (wp.getActualStartDate() == null) wp.setActualStartDate(LocalDate.now());
        }
        wp = packageRepository.save(wp);
        rollUpProgress(wp);
        return wp;
    }

    /** Averages package completion into the owning phase, then phases into the project. */
    void rollUpProgress(ContractorWorkPackage wp) {
        if (wp.getPhase() != null) {
            List<ContractorWorkPackage> siblings = packageRepository.findByPhaseIdOrderByIdAsc(wp.getPhase().getId());
            double avg = siblings.stream()
                    .filter(p -> !"CANCELLED".equals(p.getStatus()))
                    .mapToInt(p -> p.getCompletionPercentage() == null ? 0 : p.getCompletionPercentage())
                    .average().orElse(0);
            ProjectPhase phase = wp.getPhase();
            // Never drag a phase backwards: employee tasks feed the same number.
            int phasePct = Math.max(nz(phase.getCompletionPercentage()), (int) Math.round(avg));
            phase.setCompletionPercentage(Math.min(phasePct, 100));
            phaseRepository.save(phase);
        }

        Project project = wp.getProject();
        List<ProjectPhase> phases = phaseRepository.findByProjectIdOrderBySequenceAsc(project.getId());
        if (!phases.isEmpty()) {
            double avg = phases.stream()
                    .mapToInt(p -> p.getCompletionPercentage() == null ? 0 : p.getCompletionPercentage())
                    .average().orElse(0);
            project.setProgress(Math.min((int) Math.round(avg), 100));
            projectRepository.save(project);
        }
    }

    // =====================================================================
    // Financial roll-up
    // =====================================================================

    /** estimate = sum of item amounts, when the package is item-driven rather than lump-sum. */
    void recomputeEstimate(ContractorWorkPackage wp) {
        BigDecimal itemTotal = itemRepository.sumAmountByWorkPackage(wp.getId());
        if (itemTotal != null && itemTotal.signum() > 0) {
            wp.setEstimatedCost(itemTotal);
        }
        packageRepository.save(wp);
    }

    /** Refreshes approved/billed/paid so the package always shows the true committed cost. */
    @Transactional
    public ContractorWorkPackage recomputeFinancials(ContractorWorkPackage wp) {
        BigDecimal approved = assignmentRepository.findByWorkPackageIdOrderByIdAsc(wp.getId()).stream()
                .filter(a -> !"REJECTED".equals(a.getStatus()) && !"TERMINATED".equals(a.getStatus()))
                .map(a -> nz(a.getAgreedAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        wp.setApprovedCost(approved);
        wp.setBilledAmount(nz(billRepository.sumNetByWorkPackage(wp.getId())));
        wp.setPaidAmount(nz(paymentRepository.sumPaidByWorkPackage(wp.getId())));
        wp.setActualCost(wp.getBilledAmount());
        return packageRepository.save(wp);
    }

    @Transactional
    public ContractorWorkPackage recomputeFinancials(Long workPackageId) {
        return recomputeFinancials(getWorkPackage(workPackageId));
    }

    // =====================================================================
    // Change requests (BOQ variations reaching the contractor)
    // =====================================================================

    @Transactional
    public WorkPackageChange createChange(Long workPackageId, WorkPackageChange payload, User currentUser) {
        ContractorWorkPackage wp = getWorkPackage(workPackageId);
        WorkPackageChange change = new WorkPackageChange();
        change.setWorkPackage(wp);
        change.setChangeType(payload.getChangeType());
        change.setDescription(payload.getDescription());
        change.setReason(payload.getReason());
        change.setCostImpact(nz(payload.getCostImpact()));
        change.setQuantityImpact(payload.getQuantityImpact());
        change.setDaysExtension(payload.getDaysExtension());
        change.setRevisedEndDate(payload.getRevisedEndDate());
        change.setProjectChangeRequestId(payload.getProjectChangeRequestId());
        change.setRequestedBy(currentUser);
        change.setStatus("PENDING");
        change = changeRepository.save(change);
        change.setChangeNumber(String.format("WPC-%06d", change.getId()));
        change = changeRepository.save(change);

        notifyManagers("Work package variation raised",
                wp.getPackageCode() + " — " + change.getChangeType() + " with cost impact "
                        + change.getCostImpact() + ".",
                "/contractors/work-packages/" + wp.getId());
        return change;
    }

    @Transactional
    public WorkPackageChange approveChange(Long changeId, User currentUser) {
        WorkPackageChange change = changeRepository.findById(changeId)
                .orElseThrow(() -> new IllegalArgumentException("Change not found: " + changeId));
        if (!"PENDING".equals(change.getStatus())) {
            throw new IllegalStateException("Change is already " + change.getStatus() + ".");
        }
        change.setStatus("APPROVED");
        change.setApprovedBy(currentUser);
        change.setApprovedAt(LocalDateTime.now());
        change = changeRepository.save(change);

        ContractorWorkPackage wp = change.getWorkPackage();
        wp.setEstimatedCost(nz(wp.getEstimatedCost()).add(nz(change.getCostImpact())));
        wp.setApprovedCost(nz(wp.getApprovedCost()).add(nz(change.getCostImpact())));
        if (change.getRevisedEndDate() != null) {
            wp.setEndDate(change.getRevisedEndDate());
        } else if (change.getDaysExtension() != null && wp.getEndDate() != null) {
            wp.setEndDate(wp.getEndDate().plusDays(change.getDaysExtension()));
        }
        packageRepository.save(wp);

        // Keep the lead assignment's agreed amount in step so billing limits stay correct.
        final WorkPackageChange approved = change;
        assignmentRepository.findByWorkPackageIdOrderByIdAsc(wp.getId()).stream()
                .filter(a -> "ACCEPTED".equals(a.getStatus()) || "IN_PROGRESS".equals(a.getStatus()))
                .findFirst()
                .ifPresent(a -> {
                    a.setAgreedAmount(nz(a.getAgreedAmount()).add(nz(approved.getCostImpact())));
                    if (approved.getRevisedEndDate() != null) a.setEndDate(approved.getRevisedEndDate());
                    assignmentRepository.save(a);
                });
        return approved;
    }

    @Transactional
    public WorkPackageChange rejectChange(Long changeId, String reason, User currentUser) {
        WorkPackageChange change = changeRepository.findById(changeId)
                .orElseThrow(() -> new IllegalArgumentException("Change not found: " + changeId));
        change.setStatus("REJECTED");
        change.setRejectionReason(reason);
        change.setApprovedBy(currentUser);
        change.setApprovedAt(LocalDateTime.now());
        return changeRepository.save(change);
    }

    public List<WorkPackageChange> getChanges(Long workPackageId) {
        return changeRepository.findByWorkPackageIdOrderByIdDesc(workPackageId);
    }

    /**
     * Reconciles live work packages against a freshly-revised BOQ and raises a PENDING variation
     * wherever a contractor's scope value moved. Called after a project change request is applied.
     *
     * <p>Nothing is changed silently: the delta is surfaced as a change for the PM to approve, so
     * an agreed contractor amount never shifts without a human decision.
     *
     * <p>A BOQ revision clones items with new ids, so linked items are followed through
     * {@code BoqItem.originItemId} onto the project's current revision rather than by id.
     */
    @Transactional
    public Map<String, Object> reconcileWithBoqRevision(Long projectId, Long projectChangeRequestId,
                                                        String reason, User currentUser) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));
        Boq currentBoq = project.getBoq();
        int changesRaised = 0, packagesChecked = 0, itemsRetargeted = 0;

        if (currentBoq != null) {
            for (ContractorWorkPackage wp : packageRepository.findByProjectIdOrderByIdDesc(projectId)) {
                if ("COMPLETED".equals(wp.getStatus()) || "CANCELLED".equals(wp.getStatus())) continue;
                packagesChecked++;

                BigDecimal revisedTotal = BigDecimal.ZERO;
                for (WorkPackageItem item : itemRepository.findByWorkPackageIdOrderByIdAsc(wp.getId())) {
                    BoqItem linked = item.getBoqItem();
                    if (linked == null) {
                        revisedTotal = revisedTotal.add(nz(item.getAmount()));
                        continue;
                    }
                    Long lineage = linked.getOriginItemId() != null ? linked.getOriginItemId() : linked.getId();
                    BoqItem onRevision = boqItemRepository
                            .findFirstByBoqIdAndOriginItemId(currentBoq.getId(), lineage)
                            .orElse(linked.getBoq() != null && linked.getBoq().getId().equals(currentBoq.getId())
                                    ? linked : null);
                    if (onRevision == null || !Boolean.TRUE.equals(onRevision.getIsActive())) {
                        continue; // item dropped from the BOQ — its value leaves the package
                    }
                    if (!onRevision.getId().equals(linked.getId())) {
                        item.setBoqItem(onRevision); // keep the link pointing at the live revision
                        itemRepository.save(item);
                        itemsRetargeted++;
                    }
                    revisedTotal = revisedTotal.add(nz(onRevision.getLabourTotal()));
                }

                BigDecimal delta = revisedTotal.subtract(nz(wp.getEstimatedCost()));
                if (delta.signum() == 0) continue;
                // One variation per package per change request — re-running the reconcile is safe.
                boolean already = changeRepository.findByWorkPackageIdOrderByIdDesc(wp.getId()).stream()
                        .anyMatch(c -> "PENDING".equals(c.getStatus())
                                && projectChangeRequestId != null
                                && projectChangeRequestId.equals(c.getProjectChangeRequestId()));
                if (already) continue;

                WorkPackageChange change = new WorkPackageChange();
                change.setChangeType(delta.signum() > 0 ? "ADDITIONAL_WORK" : "REDUCED_SCOPE");
                change.setDescription("BOQ revision changed this package's scope value from "
                        + nz(wp.getEstimatedCost()) + " to " + revisedTotal + ".");
                change.setReason(reason);
                change.setCostImpact(delta);
                change.setProjectChangeRequestId(projectChangeRequestId);
                createChange(wp.getId(), change, currentUser);
                changesRaised++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("packagesChecked", packagesChecked);
        result.put("itemsRetargeted", itemsRetargeted);
        result.put("changesRaised", changesRaised);
        return result;
    }

    // =====================================================================
    // Automation: work packages from an approved BOQ
    // =====================================================================

    /**
     * Buckets the project's BOQ items by phase + room + trade and creates one draft work package
     * per bucket. Re-runnable: an existing package for the same bucket is topped up with any
     * newly-approved BOQ items rather than duplicated (same idempotency approach as
     * {@code ProjectService.reconcileProjectWithBoq}).
     */
    @Transactional
    public Map<String, Object> generateFromBoq(Long projectId, User currentUser) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));
        Boq boq = project.getBoq();
        if (boq == null) {
            throw new IllegalStateException("Project " + project.getProjectCode()
                    + " has no BOQ — generate the BOQ from the measurement first.");
        }

        List<BoqItem> items = boqItemRepository.findByBoqId(boq.getId()).stream()
                .filter(i -> Boolean.TRUE.equals(i.getIsActive()))
                .filter(i -> !"REJECTED".equalsIgnoreCase(i.getStatus()))
                // Only customer-approved scope becomes contractor work.
                .filter(i -> "APPROVED".equalsIgnoreCase(i.getStatus()) || "EXECUTED".equalsIgnoreCase(i.getStatus()))
                .toList();

        List<ProjectPhase> phases = phaseRepository.findByProjectIdOrderBySequenceAsc(projectId);
        Map<Long, ProjectPhase> phasesByBoqPhase = new HashMap<>();
        for (ProjectPhase p : phases) {
            if (p.getBoqPhaseId() != null) phasesByBoqPhase.put(p.getBoqPhaseId(), p);
        }
        ProjectPhase defaultPhase = phases.stream().filter(p -> p.getBoqPhaseId() == null).findFirst()
                .orElse(phases.isEmpty() ? null : phases.get(0));

        int packagesCreated = 0, packagesUpdated = 0, itemsLinked = 0, itemsSkipped = 0;

        // Group by the bucket key so one package covers one trade in one room of one phase.
        Map<String, List<BoqItem>> buckets = new LinkedHashMap<>();
        Map<String, ProjectPhase> bucketPhase = new HashMap<>();
        Map<String, ProjectRoom> bucketRoom = new HashMap<>();

        for (BoqItem item : items) {
            ProjectPhase phase = item.getPhase() != null
                    ? phasesByBoqPhase.getOrDefault(item.getPhase().getId(), defaultPhase)
                    : defaultPhase;
            ProjectRoom room = null;
            if (phase != null && item.getRoomName() != null) {
                room = roomRepository.findByPhaseIdAndRoomName(phase.getId(), item.getRoomName()).orElse(null);
            }
            String trade = tradeFor(item);
            String key = (phase == null ? "0" : phase.getId()) + ":"
                    + (room == null ? "0" : room.getId()) + ":" + trade;
            buckets.computeIfAbsent(key, k -> new ArrayList<>()).add(item);
            if (phase != null) bucketPhase.put(key, phase);
            if (room != null) bucketRoom.put(key, room);
        }

        for (Map.Entry<String, List<BoqItem>> entry : buckets.entrySet()) {
            String key = entry.getKey();
            List<BoqItem> bucketItems = entry.getValue();
            ProjectPhase phase = bucketPhase.get(key);
            ProjectRoom room = bucketRoom.get(key);
            String trade = key.substring(key.lastIndexOf(':') + 1);

            Optional<ContractorWorkPackage> existing =
                    packageRepository.findFirstByProjectIdAndSourceTradeKey(projectId, key);
            ContractorWorkPackage wp;
            if (existing.isPresent()) {
                wp = existing.get();
                packagesUpdated++;
            } else {
                wp = new ContractorWorkPackage();
                wp.setProject(project);
                wp.setPhase(phase);
                wp.setRoom(room);
                wp.setBoq(boq);
                wp.setTrade(trade);
                wp.setSourceTradeKey(key);
                wp.setSourceBoqPhaseId(bucketItems.get(0).getPhase() != null
                        ? bucketItems.get(0).getPhase().getId() : null);
                wp.setPackageName(buildPackageName(phase, room, trade));
                wp.setStatus("PENDING_ASSIGNMENT");
                wp.setRateType("FIXED_CONTRACT");
                wp.setRetentionPercentage(BigDecimal.valueOf(5));
                wp.setStartDate(project.getStartDate());
                wp.setEndDate(phase != null ? phase.getEndDate() : project.getEndDate());
                wp.setSiteEngineer(project.getSiteEngineer());
                wp.setCreatedByUser(currentUser);
                wp = packageRepository.save(wp);
                wp.setPackageCode(nextPackageCode(wp.getId()));
                wp = packageRepository.save(wp);
                packagesCreated++;
            }

            if ("COMPLETED".equals(wp.getStatus()) || "CANCELLED".equals(wp.getStatus())) {
                itemsSkipped += bucketItems.size();
                continue;
            }
            for (BoqItem item : bucketItems) {
                try {
                    itemsLinked += addBoqItems(wp.getId(), List.of(item.getId())).size();
                } catch (IllegalStateException alreadyAllocated) {
                    itemsSkipped++; // claimed by another package — leave it where it is
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("packagesCreated", packagesCreated);
        result.put("packagesUpdated", packagesUpdated);
        result.put("itemsLinked", itemsLinked);
        result.put("itemsSkipped", itemsSkipped);
        result.put("boqItemsConsidered", items.size());
        return result;
    }

    /** Maps a BOQ item's category to a contractor trade, defaulting to CIVIL when unrecognised. */
    String tradeFor(BoqItem item) {
        String category = item.getCategory() == null ? "" : item.getCategory().toLowerCase(Locale.ROOT).trim();
        String direct = CATEGORY_TO_TRADE.get(category);
        if (direct != null) return direct;
        for (Map.Entry<String, String> entry : CATEGORY_TO_TRADE.entrySet()) {
            if (category.contains(entry.getKey())) return entry.getValue();
        }
        String name = item.getItemName() == null ? "" : item.getItemName().toLowerCase(Locale.ROOT);
        for (Map.Entry<String, String> entry : CATEGORY_TO_TRADE.entrySet()) {
            if (name.contains(entry.getKey())) return entry.getValue();
        }
        return "CIVIL";
    }

    private String buildPackageName(ProjectPhase phase, ProjectRoom room, String trade) {
        String tradeLabel = trade.charAt(0) + trade.substring(1).toLowerCase(Locale.ROOT).replace('_', ' ');
        if (room != null) return room.getRoomName() + " " + tradeLabel;
        if (phase != null) return phase.getName() + " " + tradeLabel;
        return tradeLabel + " Works";
    }

    private String nextPackageCode(Long id) {
        String candidate = String.format("WP-%06d", id);
        while (packageRepository.existsByPackageCode(candidate)) {
            candidate = "WP-" + System.currentTimeMillis();
        }
        return candidate;
    }

    // =====================================================================
    // Notification helpers
    // =====================================================================

    void notifyManagers(String title, String message, String actionUrl) {
        for (User recipient : userRepository.findByRoleNames(CONTRACTOR_ALERT_ROLES)) {
            notificationService.dispatch(title, message, "CONTRACTOR", recipient.getId(), actionUrl);
        }
    }

    void notifyContractor(Contractor contractor, String title, String message, String actionUrl) {
        if (contractor.getUser() != null) {
            notificationService.dispatch(title, message, "CONTRACTOR", contractor.getUser().getId(), actionUrl);
        }
    }

    // =====================================================================
    // Small helpers
    // =====================================================================

    static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
