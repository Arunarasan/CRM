package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The contractor's own view of the system, scoped to the {@link Contractor} linked to the
 * signed-in {@link User}. Every read and write here re-derives that contractor from the
 * security context — a contractor can never address another contractor's records by id.
 */
@Service
public class ContractorPortalService {

    @Autowired private ContractorRepository contractorRepository;
    @Autowired private ContractorWorkPackageRepository packageRepository;
    @Autowired private WorkPackageAssignmentRepository assignmentRepository;
    @Autowired private ContractorMaterialIssueRepository issueRepository;
    @Autowired private ContractorMaterialIssueItemRepository issueItemRepository;
    @Autowired private ContractorBillRepository billRepository;
    @Autowired private ContractorPaymentRepository paymentRepository;
    @Autowired private ContractorDailyProgressRepository progressRepository;
    @Autowired private WorkPackageService workPackageService;
    @Autowired private ContractorExecutionService executionService;
    @Autowired private ContractorLedgerService ledgerService;
    @Autowired private MaterialRequestService materialRequestService;

    /** Resolves the contractor behind the signed-in user, or fails loudly. */
    public Contractor requireContractor(User currentUser) {
        if (currentUser == null) {
            throw new IllegalStateException("Not authenticated.");
        }
        return contractorRepository.findByUserId(currentUser.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "This login is not linked to a contractor account."));
    }

    public Map<String, Object> getDashboard(User currentUser) {
        Contractor contractor = requireContractor(currentUser);
        List<ContractorWorkPackage> packages = packageRepository.findByContractorId(contractor.getId());
        LocalDate today = LocalDate.now();

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("contractor", contractor);
        dashboard.put("assignedPackages", packages.stream().filter(p -> "ASSIGNED".equals(p.getStatus())).count());
        dashboard.put("activePackages", packages.stream()
                .filter(p -> "ACCEPTED".equals(p.getStatus()) || "IN_PROGRESS".equals(p.getStatus())).count());
        dashboard.put("completedPackages", packages.stream().filter(p -> "COMPLETED".equals(p.getStatus())).count());
        dashboard.put("delayedPackages", packages.stream()
                .filter(p -> p.getEndDate() != null && p.getEndDate().isBefore(today)
                        && !"COMPLETED".equals(p.getStatus()) && !"CANCELLED".equals(p.getStatus())).count());
        dashboard.put("outstandingAmount", nz(billRepository.sumOutstandingByContractor(contractor.getId())));
        dashboard.put("retentionHeld", nz(billRepository.sumRetentionByContractor(contractor.getId())));
        dashboard.put("totalReceived", nz(paymentRepository.sumPaidByContractor(contractor.getId())));
        dashboard.put("ledgerBalance", ledgerService.getBalance(contractor.getId()));
        return dashboard;
    }

    // =====================================================================
    // Work
    // =====================================================================

    public List<ContractorWorkPackage> getMyWorkPackages(User currentUser) {
        return packageRepository.findByContractorId(requireContractor(currentUser).getId());
    }

    public List<WorkPackageAssignment> getMyAssignments(User currentUser) {
        return assignmentRepository.findByContractorIdOrderByIdDesc(requireContractor(currentUser).getId());
    }

    public Map<String, Object> getMyWorkPackage(Long workPackageId, User currentUser) {
        Contractor contractor = requireContractor(currentUser);
        assertOwnsPackage(contractor, workPackageId);
        return workPackageService.getWorkPackageDetail(workPackageId);
    }

    @Transactional
    public WorkPackageAssignment acceptWork(Long assignmentId, String remarks, User currentUser) {
        Contractor contractor = requireContractor(currentUser);
        WorkPackageAssignment assignment = workPackageService.getAssignment(assignmentId);
        assertOwnsAssignment(contractor, assignment);
        return workPackageService.acceptAssignment(assignmentId, remarks);
    }

    @Transactional
    public WorkPackageAssignment rejectWork(Long assignmentId, String reason, User currentUser) {
        Contractor contractor = requireContractor(currentUser);
        WorkPackageAssignment assignment = workPackageService.getAssignment(assignmentId);
        assertOwnsAssignment(contractor, assignment);
        return workPackageService.rejectAssignment(assignmentId, reason);
    }

    // =====================================================================
    // Progress
    // =====================================================================

    public List<ContractorDailyProgress> getMyProgress(User currentUser) {
        return progressRepository.findByContractorIdOrderByProgressDateDesc(requireContractor(currentUser).getId());
    }

    @Transactional
    public ContractorDailyProgress submitProgress(Long workPackageId, ContractorDailyProgress progress,
                                                  List<ContractorProgressMedia> media, User currentUser) {
        Contractor contractor = requireContractor(currentUser);
        assertOwnsPackage(contractor, workPackageId);
        return executionService.recordProgress(workPackageId, contractor.getId(), progress, media, currentUser);
    }

    // =====================================================================
    // Materials
    // =====================================================================

    public List<ContractorMaterialIssue> getMyMaterialIssues(User currentUser) {
        return issueRepository.findByContractorIdOrderByIdDesc(requireContractor(currentUser).getId());
    }

    public Map<String, Object> getMyMaterialIssue(Long issueId, User currentUser) {
        Contractor contractor = requireContractor(currentUser);
        ContractorMaterialIssue issue = executionService.getIssue(issueId);
        if (!issue.getContractor().getId().equals(contractor.getId())) {
            throw new IllegalStateException("This material issue does not belong to you.");
        }
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("issue", issue);
        detail.put("items", issueItemRepository.findByIssueIdOrderByIdAsc(issueId));
        return detail;
    }

    /**
     * Raises a store material request against the contractor's own work package. It enters the
     * existing employee/field material-request queue rather than a parallel contractor one.
     */
    @Transactional
    public MaterialRequest requestMaterial(Long workPackageId, Long warehouseId,
                                           List<Map<String, Object>> items, String remarks, User currentUser) {
        Contractor contractor = requireContractor(currentUser);
        ContractorWorkPackage wp = workPackageService.getWorkPackage(workPackageId);
        assertOwnsPackage(contractor, workPackageId);
        String note = "Contractor " + contractor.getName() + " — " + wp.getPackageCode()
                + (remarks == null || remarks.isBlank() ? "" : ": " + remarks);
        return materialRequestService.create(null, wp.getProject().getId(), warehouseId, items, note, currentUser);
    }

    // =====================================================================
    // Money
    // =====================================================================

    public List<ContractorBill> getMyBills(User currentUser) {
        return billRepository.findByContractorIdOrderByIdDesc(requireContractor(currentUser).getId());
    }

    public List<ContractorPayment> getMyPayments(User currentUser) {
        return paymentRepository.findByContractorIdOrderByPaymentDateDesc(requireContractor(currentUser).getId());
    }

    public Map<String, Object> getMyLedger(User currentUser, LocalDate from, LocalDate to) {
        return ledgerService.getLedger(requireContractor(currentUser).getId(), from, to);
    }

    // =====================================================================
    // Ownership guards
    // =====================================================================

    private void assertOwnsPackage(Contractor contractor, Long workPackageId) {
        boolean owns = assignmentRepository.findByWorkPackageIdOrderByIdAsc(workPackageId).stream()
                .anyMatch(a -> a.getContractor().getId().equals(contractor.getId())
                        && !"REJECTED".equals(a.getStatus()) && !"TERMINATED".equals(a.getStatus()));
        if (!owns) {
            throw new IllegalStateException("Work package " + workPackageId + " is not assigned to you.");
        }
    }

    private void assertOwnsAssignment(Contractor contractor, WorkPackageAssignment assignment) {
        if (!assignment.getContractor().getId().equals(contractor.getId())) {
            throw new IllegalStateException("This assignment does not belong to you.");
        }
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
