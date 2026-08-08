package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Site-level execution against a work package: material issue and reconciliation,
 * daily progress, quality inspection, labour attendance and safety records.
 *
 * <p>Material movements go through {@link InventoryService} so contractor issues appear in the
 * same stock ledger as every other movement — there is no parallel inventory here.
 */
@Service
public class ContractorExecutionService {

    @Autowired private ContractorMaterialIssueRepository issueRepository;
    @Autowired private ContractorMaterialIssueItemRepository issueItemRepository;
    @Autowired private ContractorDailyProgressRepository progressRepository;
    @Autowired private ContractorProgressMediaRepository mediaRepository;
    @Autowired private ContractorQualityInspectionRepository inspectionRepository;
    @Autowired private ContractorAttendanceRepository attendanceRepository;
    @Autowired private ContractorSafetyRecordRepository safetyRepository;
    @Autowired private ContractorWorkPackageRepository packageRepository;
    @Autowired private ContractorRepository contractorRepository;
    @Autowired private WorkPackageItemRepository workPackageItemRepository;
    @Autowired private ProjectMaterialRequirementRepository materialRequirementRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private WarehouseRepository warehouseRepository;
    @Autowired private InventoryService inventoryService;
    @Autowired private WorkPackageService workPackageService;
    @Autowired private ContractorLedgerService ledgerService;

    // =====================================================================
    // Material issue
    // =====================================================================

    public List<ContractorMaterialIssue> getIssuesForPackage(Long workPackageId) {
        return issueRepository.findByWorkPackageIdOrderByIdDesc(workPackageId);
    }

    public List<ContractorMaterialIssue> getIssuesForContractor(Long contractorId) {
        return issueRepository.findByContractorIdOrderByIdDesc(contractorId);
    }

    public Map<String, Object> getIssueDetail(Long issueId) {
        ContractorMaterialIssue issue = getIssue(issueId);
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("issue", issue);
        detail.put("items", issueItemRepository.findByIssueIdOrderByIdAsc(issueId));
        return detail;
    }

    public ContractorMaterialIssue getIssue(Long id) {
        return issueRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Material issue not found: " + id));
    }

    /** Creates the issue in DRAFT — nothing leaves stock until {@link #confirmIssue}. */
    @Transactional
    public ContractorMaterialIssue createIssue(Long workPackageId, Long contractorId, Long warehouseId,
                                               ContractorMaterialIssue payload,
                                               List<ContractorMaterialIssueItem> items, User currentUser) {
        ContractorWorkPackage wp = workPackageService.getWorkPackage(workPackageId);
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));

        ContractorMaterialIssue issue = new ContractorMaterialIssue();
        issue.setWorkPackage(wp);
        issue.setContractor(contractor);
        issue.setProject(wp.getProject());
        if (warehouseId != null) {
            issue.setWarehouse(warehouseRepository.findById(warehouseId).orElse(null));
        }
        issue.setIssueDate(payload.getIssueDate() != null ? payload.getIssueDate() : LocalDate.now());
        issue.setReceivedBy(payload.getReceivedBy());
        issue.setRemarks(payload.getRemarks());
        issue.setIssuedBy(currentUser);
        issue.setStatus("DRAFT");
        issue = issueRepository.save(issue);
        issue.setIssueNumber(String.format("CMI-%06d", issue.getId()));
        issue = issueRepository.save(issue);

        for (ContractorMaterialIssueItem payloadItem : items) {
            Product product = productRepository.findById(payloadItem.getProduct().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Product not found"));
            ContractorMaterialIssueItem item = new ContractorMaterialIssueItem();
            item.setIssue(issue);
            item.setProduct(product);
            item.setUnit(payloadItem.getUnit() != null ? payloadItem.getUnit() : product.getUnit());
            item.setIssuedQuantity(nz(payloadItem.getIssuedQuantity()));
            item.setUnitRate(payloadItem.getUnitRate() != null ? payloadItem.getUnitRate() : costOf(product));
            item.setTotalValue(item.getIssuedQuantity().multiply(item.getUnitRate()).setScale(2, RoundingMode.HALF_UP));
            item.setRemarks(payloadItem.getRemarks());
            issueItemRepository.save(item);
        }
        return recomputeIssueTotals(issue);
    }

    /**
     * Confirms the issue: stock leaves the warehouse as a CONSUMPTION movement referencing the
     * work package, and the project's material requirement rows record the issued quantity.
     */
    @Transactional
    public ContractorMaterialIssue confirmIssue(Long issueId) {
        ContractorMaterialIssue issue = getIssue(issueId);
        if (!"DRAFT".equals(issue.getStatus())) {
            throw new IllegalStateException("Only a DRAFT issue can be confirmed (currently " + issue.getStatus() + ").");
        }
        Warehouse warehouse = issue.getWarehouse();

        for (ContractorMaterialIssueItem item : issueItemRepository.findByIssueIdOrderByIdAsc(issueId)) {
            int qty = item.getIssuedQuantity().setScale(0, RoundingMode.HALF_UP).intValue();
            if (qty <= 0) continue;

            InventoryTransaction tx = new InventoryTransaction();
            tx.setProduct(item.getProduct());
            tx.setSourceWarehouse(warehouse);
            tx.setType("CONSUMPTION");
            tx.setQuantity(qty);
            tx.setDate(LocalDateTime.now());
            tx.setReferenceType("CONTRACTOR_ISSUE");
            tx.setReferenceId(issue.getId());
            tx.setReference(issue.getIssueNumber());
            tx.setProject(issue.getProject());
            tx.setNotes("Issued to contractor " + issue.getContractor().getName()
                    + " for " + issue.getWorkPackage().getPackageCode());
            inventoryService.processTransaction(tx);

            bumpRequirement(issue.getProject().getId(), item.getProduct().getId(), item.getIssuedQuantity(), true);
        }

        issue.setStatus("ISSUED");
        return issueRepository.save(issue);
    }

    /**
     * Reconciles what actually happened on site. Returned quantities go back into stock;
     * waste and damage are priced and become a recovery on the contractor's next bill.
     */
    @Transactional
    public ContractorMaterialIssue reconcileIssue(Long issueId, List<ContractorMaterialIssueItem> lines) {
        ContractorMaterialIssue issue = getIssue(issueId);
        if ("DRAFT".equals(issue.getStatus()) || "CANCELLED".equals(issue.getStatus())) {
            throw new IllegalStateException("Issue " + issue.getIssueNumber()
                    + " is " + issue.getStatus() + " and cannot be reconciled.");
        }

        for (ContractorMaterialIssueItem line : lines) {
            ContractorMaterialIssueItem item = issueItemRepository.findById(line.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Issue line not found: " + line.getId()));
            BigDecimal previouslyReturned = nz(item.getReturnedQuantity());
            BigDecimal newReturned = nz(line.getReturnedQuantity());
            BigDecimal returnDelta = newReturned.subtract(previouslyReturned);

            item.setReturnedQuantity(newReturned);
            item.setConsumedQuantity(nz(line.getConsumedQuantity()));
            item.setWasteQuantity(nz(line.getWasteQuantity()));
            item.setDamagedQuantity(nz(line.getDamagedQuantity()));
            if (line.getRemarks() != null) item.setRemarks(line.getRemarks());

            BigDecimal recoverableQty = item.getWasteQuantity().add(item.getDamagedQuantity());
            item.setRecoverableValue(recoverableQty.multiply(nz(item.getUnitRate())).setScale(2, RoundingMode.HALF_UP));
            issueItemRepository.save(item);

            if (returnDelta.signum() > 0) {
                int qty = returnDelta.setScale(0, RoundingMode.HALF_UP).intValue();
                if (qty > 0) {
                    InventoryTransaction tx = new InventoryTransaction();
                    tx.setProduct(item.getProduct());
                    tx.setDestinationWarehouse(issue.getWarehouse());
                    tx.setType("PROJECT_RETURN");
                    tx.setQuantity(qty);
                    tx.setDate(LocalDateTime.now());
                    tx.setReferenceType("CONTRACTOR_RETURN");
                    tx.setReferenceId(issue.getId());
                    tx.setReference(issue.getIssueNumber());
                    tx.setProject(issue.getProject());
                    tx.setNotes("Returned by contractor " + issue.getContractor().getName());
                    inventoryService.processTransaction(tx);
                    bumpRequirement(issue.getProject().getId(), item.getProduct().getId(), returnDelta, false);
                }
            }
        }

        issue = recomputeIssueTotals(issue);
        boolean fullyReconciled = issueItemRepository.findByIssueIdOrderByIdAsc(issueId).stream()
                .allMatch(i -> i.getUnreconciledQuantity().signum() <= 0);
        issue.setStatus(fullyReconciled ? "RECONCILED" : "PARTIALLY_RETURNED");
        return issueRepository.save(issue);
    }

    @Transactional
    public ContractorMaterialIssue cancelIssue(Long issueId, String reason) {
        ContractorMaterialIssue issue = getIssue(issueId);
        if (!"DRAFT".equals(issue.getStatus())) {
            throw new IllegalStateException("Only a DRAFT issue can be cancelled — reconcile the issue instead.");
        }
        issue.setStatus("CANCELLED");
        issue.setRemarks(reason);
        return issueRepository.save(issue);
    }

    private ContractorMaterialIssue recomputeIssueTotals(ContractorMaterialIssue issue) {
        List<ContractorMaterialIssueItem> items = issueItemRepository.findByIssueIdOrderByIdAsc(issue.getId());
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal recoverable = BigDecimal.ZERO;
        for (ContractorMaterialIssueItem item : items) {
            item.setTotalValue(nz(item.getIssuedQuantity()).multiply(nz(item.getUnitRate()))
                    .setScale(2, RoundingMode.HALF_UP));
            issueItemRepository.save(item);
            total = total.add(item.getTotalValue());
            recoverable = recoverable.add(nz(item.getRecoverableValue()));
        }
        issue.setTotalValue(total);
        issue.setRecoverableValue(recoverable);
        return issueRepository.save(issue);
    }

    /** Mirrors the movement onto the project's material requirement so planning stays accurate. */
    private void bumpRequirement(Long projectId, Long productId, BigDecimal qty, boolean issued) {
        materialRequirementRepository.findByProjectIdOrderByIdAsc(projectId).stream()
                .filter(r -> r.getProduct() != null && r.getProduct().getId().equals(productId))
                .findFirst()
                .ifPresent(req -> {
                    if (issued) {
                        req.setIssuedQty(nz(req.getIssuedQty()).add(qty));
                    } else {
                        req.setReturnedQty(nz(req.getReturnedQty()).add(qty));
                    }
                    materialRequirementRepository.save(req);
                });
    }

    private BigDecimal costOf(Product product) {
        if (product.getCostPrice() != null) return product.getCostPrice();
        if (product.getPurchasePrice() != null) return product.getPurchasePrice();
        return product.getPrice() != null ? product.getPrice() : BigDecimal.ZERO;
    }

    // =====================================================================
    // Daily progress
    // =====================================================================

    public List<ContractorDailyProgress> getProgressForPackage(Long workPackageId) {
        return progressRepository.findByWorkPackageIdOrderByProgressDateDesc(workPackageId);
    }

    public List<ContractorDailyProgress> getProgressForProject(Long projectId) {
        return progressRepository.findByProjectIdOrderByProgressDateDesc(projectId);
    }

    public List<ContractorDailyProgress> getTodaysProgress() {
        return progressRepository.findByProgressDateOrderByIdDesc(LocalDate.now());
    }

    public List<ContractorProgressMedia> getProgressMedia(Long progressId) {
        return mediaRepository.findByProgressIdOrderByIdAsc(progressId);
    }

    /** One report per contractor per package per day — a second submission updates the first. */
    @Transactional
    public ContractorDailyProgress recordProgress(Long workPackageId, Long contractorId,
                                                  ContractorDailyProgress payload,
                                                  List<ContractorProgressMedia> media, User currentUser) {
        ContractorWorkPackage wp = workPackageService.getWorkPackage(workPackageId);
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));
        LocalDate date = payload.getProgressDate() != null ? payload.getProgressDate() : LocalDate.now();

        ContractorDailyProgress progress = progressRepository
                .findFirstByWorkPackageIdAndContractorIdAndProgressDate(workPackageId, contractorId, date)
                .orElseGet(ContractorDailyProgress::new);

        progress.setWorkPackage(wp);
        progress.setContractor(contractor);
        progress.setProject(wp.getProject());
        progress.setProgressDate(date);
        progress.setWorkDone(payload.getWorkDone());
        progress.setCompletionPercentage(payload.getCompletionPercentage() == null ? 0 : payload.getCompletionPercentage());
        progress.setQuantityCompleted(payload.getQuantityCompleted());
        progress.setUnit(payload.getUnit() != null ? payload.getUnit() : wp.getUnit());
        progress.setWorkersCount(payload.getWorkersCount());
        progress.setSupervisorName(payload.getSupervisorName());
        progress.setIssues(payload.getIssues());
        progress.setRemarks(payload.getRemarks());
        progress.setWeather(payload.getWeather());
        progress.setStatus("SUBMITTED");
        progress.setReportedBy(currentUser);
        progress = progressRepository.save(progress);

        if (media != null) {
            for (ContractorProgressMedia m : media) {
                ContractorProgressMedia saved = new ContractorProgressMedia();
                saved.setProgress(progress);
                saved.setMediaType(m.getMediaType() != null ? m.getMediaType() : "PHOTO");
                saved.setFileUrl(m.getFileUrl());
                saved.setFileName(m.getFileName());
                saved.setCaption(m.getCaption());
                mediaRepository.save(saved);
            }
        }

        // Attendance falls out of the same report when worker counts were entered.
        if (progress.getWorkersCount() != null && progress.getWorkersCount() > 0) {
            recordAttendanceFromProgress(progress, currentUser);
        }
        if (payload.getIssues() != null && !payload.getIssues().isBlank()) {
            workPackageService.notifyManagers("Site issue reported",
                    wp.getPackageCode() + " (" + contractor.getName() + "): " + payload.getIssues(),
                    "/contractors/work-packages/" + wp.getId());
        }
        return progress;
    }

    /** Verification is what makes progress count — unverified reports never move the project bar. */
    @Transactional
    public ContractorDailyProgress verifyProgress(Long progressId, boolean approve, String remarks, User currentUser) {
        ContractorDailyProgress progress = progressRepository.findById(progressId)
                .orElseThrow(() -> new IllegalArgumentException("Progress report not found: " + progressId));
        progress.setStatus(approve ? "VERIFIED" : "REJECTED");
        progress.setVerifiedBy(currentUser);
        progress.setVerifiedAt(LocalDateTime.now());
        if (remarks != null) progress.setRemarks(remarks);
        progress = progressRepository.save(progress);

        if (approve) {
            applyQuantitiesToItems(progress);
            workPackageService.recomputeCompletion(progress.getWorkPackage().getId());
        }
        return progress;
    }

    /**
     * Spreads a verified day's quantity across the package's items proportionally, so running
     * bills can be measured per line rather than only as a headline percentage.
     */
    private void applyQuantitiesToItems(ContractorDailyProgress progress) {
        Long wpId = progress.getWorkPackage().getId();
        List<WorkPackageItem> items = workPackageItemRepository.findByWorkPackageIdOrderByIdAsc(wpId);
        if (items.isEmpty()) return;

        int pct = progress.getCompletionPercentage() == null ? 0 : progress.getCompletionPercentage();
        for (WorkPackageItem item : items) {
            BigDecimal target = nz(item.getQuantity())
                    .multiply(BigDecimal.valueOf(pct))
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            // Never walk a line backwards — a later report with a lower headline shouldn't un-bill work.
            if (target.compareTo(nz(item.getCompletedQuantity())) > 0) {
                item.setCompletedQuantity(target);
                item.setStatus(target.compareTo(nz(item.getQuantity())) >= 0 ? "COMPLETED" : "IN_PROGRESS");
                workPackageItemRepository.save(item);
            }
        }
    }

    // =====================================================================
    // Quality inspection
    // =====================================================================

    public List<ContractorQualityInspection> getInspectionsForPackage(Long workPackageId) {
        return inspectionRepository.findByWorkPackageIdOrderByIdDesc(workPackageId);
    }

    public List<ContractorQualityInspection> getOpenQualityIssues() {
        List<ContractorQualityInspection> issues = new ArrayList<>(inspectionRepository.findByResultOrderByIdDesc("FAIL"));
        issues.addAll(inspectionRepository.findByResultOrderByIdDesc("REWORK"));
        return issues;
    }

    @Transactional
    public ContractorQualityInspection recordInspection(Long workPackageId, ContractorQualityInspection payload,
                                                        List<ContractorProgressMedia> media, User currentUser) {
        ContractorWorkPackage wp = workPackageService.getWorkPackage(workPackageId);
        Contractor contractor = resolveLeadContractor(wp);

        ContractorQualityInspection inspection = new ContractorQualityInspection();
        inspection.setWorkPackage(wp);
        inspection.setContractor(contractor);
        inspection.setProject(wp.getProject());
        inspection.setInspectionDate(payload.getInspectionDate() != null ? payload.getInspectionDate() : LocalDate.now());
        inspection.setInspectionType(payload.getInspectionType());
        inspection.setResult(payload.getResult() != null ? payload.getResult() : "PENDING");
        inspection.setScore(payload.getScore());
        inspection.setChecklist(payload.getChecklist());
        inspection.setObservations(payload.getObservations());
        inspection.setDefects(payload.getDefects());
        inspection.setCorrectiveAction(payload.getCorrectiveAction());
        inspection.setReworkDueDate(payload.getReworkDueDate());
        inspection.setComments(payload.getComments());
        inspection.setInspectedBy(currentUser);
        inspection = inspectionRepository.save(inspection);
        inspection.setInspectionNumber(String.format("QC-%06d", inspection.getId()));
        inspection = inspectionRepository.save(inspection);

        if (media != null) {
            for (ContractorProgressMedia m : media) {
                ContractorProgressMedia saved = new ContractorProgressMedia();
                saved.setInspection(inspection);
                saved.setMediaType(m.getMediaType() != null ? m.getMediaType() : "PHOTO");
                saved.setFileUrl(m.getFileUrl());
                saved.setFileName(m.getFileName());
                saved.setCaption(m.getCaption());
                mediaRepository.save(saved);
            }
        }
        applyInspectionToPackage(inspection, wp);
        return inspection;
    }

    /** Final sign-off on an inspection; only an APPROVED inspection unlocks package completion. */
    @Transactional
    public ContractorQualityInspection approveInspection(Long inspectionId, String comments, User currentUser) {
        ContractorQualityInspection inspection = inspectionRepository.findById(inspectionId)
                .orElseThrow(() -> new IllegalArgumentException("Inspection not found: " + inspectionId));
        if ("FAIL".equals(inspection.getResult()) || "REWORK".equals(inspection.getResult())) {
            throw new IllegalStateException("A " + inspection.getResult()
                    + " inspection cannot be approved — record a fresh inspection after the rework.");
        }
        inspection.setResult("APPROVED");
        inspection.setApprovedBy(currentUser);
        inspection.setApprovedAt(LocalDateTime.now());
        if (comments != null) inspection.setComments(comments);
        inspection = inspectionRepository.save(inspection);
        applyInspectionToPackage(inspection, inspection.getWorkPackage());
        refreshQualityRating(inspection.getContractor());
        return inspection;
    }

    private void applyInspectionToPackage(ContractorQualityInspection inspection, ContractorWorkPackage wp) {
        wp.setQualityStatus(inspection.getResult());
        if ("FAIL".equals(inspection.getResult()) || "REWORK".equals(inspection.getResult())) {
            wp.setStatus("REWORK");
            workPackageService.notifyManagers("Quality check failed",
                    wp.getPackageCode() + " failed inspection " + inspection.getInspectionNumber() + ".",
                    "/contractors/work-packages/" + wp.getId());
        }
        packageRepository.save(wp);
    }

    /** Rolls inspection scores into the contractor's quality and overall rating. */
    private void refreshQualityRating(Contractor contractor) {
        Double avgScore = inspectionRepository.averageScoreForContractor(contractor.getId());
        if (avgScore == null) return;
        // Scores are 0-100; ratings are on the 1-5 scale used across the master.
        BigDecimal quality = BigDecimal.valueOf(avgScore / 20.0).setScale(2, RoundingMode.HALF_UP);
        contractor.setRatingQuality(quality);
        contractor.setOverallRating(averageRating(contractor));
        contractorRepository.save(contractor);
    }

    static BigDecimal averageRating(Contractor c) {
        List<BigDecimal> parts = new ArrayList<>();
        if (c.getRatingQuality() != null) parts.add(c.getRatingQuality());
        if (c.getRatingTimeliness() != null) parts.add(c.getRatingTimeliness());
        if (c.getRatingSafety() != null) parts.add(c.getRatingSafety());
        if (parts.isEmpty()) return c.getOverallRating();
        BigDecimal sum = parts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(parts.size()), 2, RoundingMode.HALF_UP);
    }

    private Contractor resolveLeadContractor(ContractorWorkPackage wp) {
        return workPackageService.getAssignments(wp.getId()).stream()
                .filter(a -> !"REJECTED".equals(a.getStatus()) && !"TERMINATED".equals(a.getStatus()))
                .map(WorkPackageAssignment::getContractor)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Work package " + wp.getPackageCode()
                        + " has no contractor assigned yet."));
    }

    // =====================================================================
    // Attendance
    // =====================================================================

    public List<ContractorAttendance> getAttendanceForPackage(Long workPackageId) {
        return attendanceRepository.findByWorkPackageIdOrderByDateDesc(workPackageId);
    }

    public List<ContractorAttendance> getAttendanceForContractor(Long contractorId, LocalDate from, LocalDate to) {
        if (from != null && to != null) {
            return attendanceRepository.findForContractorBetween(contractorId, from, to);
        }
        return attendanceRepository.findByContractorIdOrderByDateDesc(contractorId);
    }

    @Transactional
    public ContractorAttendance recordAttendance(Long contractorId, Long workPackageId,
                                                 ContractorAttendance payload, User currentUser) {
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));
        ContractorWorkPackage wp = workPackageId == null ? null : workPackageService.getWorkPackage(workPackageId);
        LocalDate date = payload.getDate() != null ? payload.getDate() : LocalDate.now();

        ContractorAttendance attendance = workPackageId == null ? new ContractorAttendance()
                : attendanceRepository.findFirstByContractorIdAndWorkPackageIdAndDate(contractorId, workPackageId, date)
                        .orElseGet(ContractorAttendance::new);

        attendance.setContractor(contractor);
        attendance.setWorkPackage(wp);
        attendance.setProject(wp != null ? wp.getProject() : attendance.getProject());
        attendance.setDate(date);
        attendance.setStatus(payload.getStatus() != null ? payload.getStatus() : "PRESENT");
        attendance.setWorkersCount(payload.getWorkersCount());
        attendance.setSkilledCount(payload.getSkilledCount());
        attendance.setUnskilledCount(payload.getUnskilledCount());
        attendance.setSupervisorName(payload.getSupervisorName());
        attendance.setInTime(payload.getInTime());
        attendance.setOutTime(payload.getOutTime());
        attendance.setRemarks(payload.getRemarks());
        attendance.setRecordedBy(currentUser);
        if (payload.getHoursWorked() != null) {
            attendance.setHoursWorked(payload.getHoursWorked());
        } else if (payload.getInTime() != null && payload.getOutTime() != null) {
            long minutes = java.time.Duration.between(payload.getInTime(), payload.getOutTime()).toMinutes();
            attendance.setHoursWorked(BigDecimal.valueOf(minutes)
                    .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP));
        }
        return attendanceRepository.save(attendance);
    }

    private void recordAttendanceFromProgress(ContractorDailyProgress progress, User currentUser) {
        ContractorAttendance payload = new ContractorAttendance();
        payload.setDate(progress.getProgressDate());
        payload.setStatus("PRESENT");
        payload.setWorkersCount(progress.getWorkersCount());
        payload.setSupervisorName(progress.getSupervisorName());
        recordAttendance(progress.getContractor().getId(), progress.getWorkPackage().getId(), payload, currentUser);
    }

    // =====================================================================
    // Safety
    // =====================================================================

    public List<ContractorSafetyRecord> getSafetyForContractor(Long contractorId) {
        return safetyRepository.findByContractorIdOrderByIdDesc(contractorId);
    }

    public List<ContractorSafetyRecord> getSafetyForPackage(Long workPackageId) {
        return safetyRepository.findByWorkPackageIdOrderByIdDesc(workPackageId);
    }

    @Transactional
    public ContractorSafetyRecord recordSafety(Long contractorId, Long workPackageId,
                                               ContractorSafetyRecord payload, User currentUser) {
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));
        ContractorWorkPackage wp = workPackageId == null ? null : workPackageService.getWorkPackage(workPackageId);
        if (wp == null && payload.getProject() == null) {
            throw new IllegalArgumentException("A safety record needs either a work package or a project.");
        }

        ContractorSafetyRecord record = new ContractorSafetyRecord();
        record.setContractor(contractor);
        record.setWorkPackage(wp);
        record.setProject(wp != null ? wp.getProject() : payload.getProject());
        record.setRecordDate(payload.getRecordDate() != null ? payload.getRecordDate() : LocalDate.now());
        record.setRecordType(payload.getRecordType());
        record.setSeverity(payload.getSeverity());
        record.setPpeCompliant(payload.getPpeCompliant() == null || payload.getPpeCompliant());
        record.setChecklist(payload.getChecklist());
        record.setDescription(payload.getDescription());
        record.setActionTaken(payload.getActionTaken());
        record.setPenaltyAmount(nz(payload.getPenaltyAmount()));
        record.setPhotoUrl(payload.getPhotoUrl());
        record.setStatus(payload.getStatus() != null ? payload.getStatus() : "OPEN");
        record.setRecordedBy(currentUser);
        record = safetyRepository.save(record);

        if (record.getPenaltyAmount().signum() > 0) {
            ledgerService.postPenalty(record);
        }
        if ("INCIDENT".equals(record.getRecordType()) || "VIOLATION".equals(record.getRecordType())) {
            refreshSafetyRating(contractor);
            workPackageService.notifyManagers("Safety " + record.getRecordType().toLowerCase(),
                    contractor.getName() + ": " + (record.getDescription() == null ? "" : record.getDescription()),
                    "/contractors/" + contractor.getId());
        }
        return record;
    }

    @Transactional
    public ContractorSafetyRecord closeSafetyRecord(Long recordId, String actionTaken) {
        ContractorSafetyRecord record = safetyRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("Safety record not found: " + recordId));
        record.setStatus("CLOSED");
        if (actionTaken != null) record.setActionTaken(actionTaken);
        return safetyRepository.save(record);
    }

    /** Safety rating starts at 5 and loses half a point per logged incident/violation, floored at 1. */
    private void refreshSafetyRating(Contractor contractor) {
        long incidents = safetyRepository.countByContractorIdAndRecordType(contractor.getId(), "INCIDENT")
                + safetyRepository.countByContractorIdAndRecordType(contractor.getId(), "VIOLATION");
        BigDecimal rating = BigDecimal.valueOf(5)
                .subtract(BigDecimal.valueOf(incidents).multiply(BigDecimal.valueOf(0.5)));
        if (rating.compareTo(BigDecimal.ONE) < 0) rating = BigDecimal.ONE;
        contractor.setRatingSafety(rating.setScale(2, RoundingMode.HALF_UP));
        contractor.setOverallRating(averageRating(contractor));
        contractorRepository.save(contractor);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
