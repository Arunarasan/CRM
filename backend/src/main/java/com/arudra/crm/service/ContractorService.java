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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Contractor master: identity, trade, statutory/banking details, compliance documents and rating.
 *
 * <p>Execution, billing and payment do not live here — they hang off work packages
 * ({@link WorkPackageService}, {@link ContractorExecutionService}, {@link ContractorBillingService}).
 */
@Service
public class ContractorService {

    /** The trades a work package can be raised for. */
    public static final List<String> TRADES = List.of(
            "CARPENTRY", "ALUMINIUM", "GLASS", "PAINTING", "ELECTRICAL", "PLUMBING",
            "FALSE_CEILING", "FABRICATION", "CIVIL", "TILES", "FURNITURE", "HVAC", "CLEANING");

    /** Contractor classifications used on the master. */
    public static final List<String> CONTRACTOR_TYPES = List.of(
            "CARPENTER", "ELECTRICIAN", "PLUMBER", "PAINTER", "FABRICATOR", "GLASS_INSTALLER",
            "TILE_LAYER", "CIVIL_CONTRACTOR", "INTERIOR_CONTRACTOR", "MODULAR_KITCHEN_VENDOR",
            "HVAC_CONTRACTOR", "CLEANING_CONTRACTOR");

    /** How far ahead the compliance widget looks for lapsing documents. */
    private static final int COMPLIANCE_WINDOW_DAYS = 30;

    @Autowired private ContractorRepository contractorRepository;
    @Autowired private ContractorProjectRepository contractorProjectRepository;
    @Autowired private ContractorAttendanceRepository attendanceRepository;
    @Autowired private ContractorPaymentRepository paymentRepository;
    @Autowired private ContractorDocumentRepository documentRepository;
    @Autowired private ContractorWorkPackageRepository packageRepository;
    @Autowired private WorkPackageAssignmentRepository assignmentRepository;
    @Autowired private ContractorBillRepository billRepository;
    @Autowired private ContractorSafetyRecordRepository safetyRepository;
    @Autowired private ContractorMaterialIssueRepository materialIssueRepository;
    @Autowired private ContractorLedgerService ledgerService;

    // =====================================================================
    // Master CRUD
    // =====================================================================

    /** Legacy search kept for the existing /api/contractors list callers. */
    public Page<Contractor> getContractors(String search, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("id").descending());
        if (search != null && !search.isEmpty()) {
            return contractorRepository.searchContractors(search, pageRequest);
        }
        return contractorRepository.findAll(pageRequest);
    }

    /** Filterable master list used by the contractor module. */
    public Page<Contractor> search(String search, String trade, String status, BigDecimal minRating,
                                   int page, int size) {
        return contractorRepository.filter(blankToNull(search), blankToNull(trade), blankToNull(status),
                minRating, PageRequest.of(page, size, Sort.by("id").descending()));
    }

    public Contractor getContractorById(Long id) {
        return contractorRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + id));
    }

    /** Everything the contractor profile page needs, in one call. */
    public Map<String, Object> getContractorDetails(Long id) {
        Contractor contractor = getContractorById(id);
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("contractor", contractor);
        details.put("projects", contractorProjectRepository.findByContractorId(id));
        details.put("workPackages", packageRepository.findByContractorId(id));
        details.put("assignments", assignmentRepository.findByContractorIdOrderByIdDesc(id));
        details.put("attendance", attendanceRepository.findByContractorIdOrderByDateDesc(id));
        details.put("bills", billRepository.findByContractorIdOrderByIdDesc(id));
        details.put("payments", paymentRepository.findByContractorIdOrderByPaymentDateDesc(id));
        details.put("documents", documentRepository.findByContractorId(id));
        details.put("safety", safetyRepository.findByContractorIdOrderByIdDesc(id));
        details.put("outstanding", buildOutstanding(id));
        details.put("performance", getPerformance(id));
        return details;
    }

    @Transactional
    public Contractor createContractor(Contractor contractor) {
        if (contractor.getStatus() == null) contractor.setStatus("ACTIVE");
        if (contractor.getOpeningBalance() == null) contractor.setOpeningBalance(BigDecimal.ZERO);
        Contractor saved = contractorRepository.save(contractor);
        if (saved.getContractorCode() == null || saved.getContractorCode().isBlank()) {
            saved.setContractorCode(nextContractorCode(saved.getId()));
            saved = contractorRepository.save(saved);
        }
        return saved;
    }

    @Transactional
    public Contractor updateContractor(Long id, Contractor details) {
        Contractor contractor = getContractorById(id);

        contractor.setName(details.getName());
        contractor.setEmail(details.getEmail());
        contractor.setPhone(details.getPhone());
        contractor.setAlternatePhone(details.getAlternatePhone());
        contractor.setCompanyName(details.getCompanyName());
        contractor.setOwnerName(details.getOwnerName());
        contractor.setContactPerson(details.getContactPerson());
        contractor.setSkills(details.getSkills());

        contractor.setTrade(details.getTrade());
        contractor.setTrades(details.getTrades());
        contractor.setContractorType(details.getContractorType());

        contractor.setGstin(details.getGstin());
        contractor.setPan(details.getPan());
        contractor.setPfNumber(details.getPfNumber());
        contractor.setEsiNumber(details.getEsiNumber());

        contractor.setBankName(details.getBankName());
        contractor.setBankAccountName(details.getBankAccountName());
        contractor.setBankAccountNumber(details.getBankAccountNumber());
        contractor.setBankIfsc(details.getBankIfsc());
        contractor.setBankBranch(details.getBankBranch());
        contractor.setUpiId(details.getUpiId());

        contractor.setAddressLine1(details.getAddressLine1());
        contractor.setAddressLine2(details.getAddressLine2());
        contractor.setCity(details.getCity());
        contractor.setState(details.getState());
        contractor.setPincode(details.getPincode());

        contractor.setHourlyRate(details.getHourlyRate());
        contractor.setDailyRate(details.getDailyRate());
        contractor.setCreditDays(details.getCreditDays());
        contractor.setRetentionPercentage(details.getRetentionPercentage());
        contractor.setTdsPercentage(details.getTdsPercentage());
        if (details.getOpeningBalance() != null) contractor.setOpeningBalance(details.getOpeningBalance());

        contractor.setPerformanceRating(details.getPerformanceRating());
        if (details.getStatus() != null) contractor.setStatus(details.getStatus());

        contractor.setAgreementNumber(details.getAgreementNumber());
        contractor.setAgreementStartDate(details.getAgreementStartDate());
        contractor.setAgreementEndDate(details.getAgreementEndDate());
        contractor.setInsuranceNumber(details.getInsuranceNumber());
        contractor.setInsuranceExpiryDate(details.getInsuranceExpiryDate());
        contractor.setLicenseNumber(details.getLicenseNumber());
        contractor.setLicenseExpiryDate(details.getLicenseExpiryDate());
        contractor.setNotes(details.getNotes());

        return contractorRepository.save(contractor);
    }

    /**
     * A contractor carrying work packages or bills is never physically removed — deleting the
     * row would orphan execution and financial history. Those are marked INACTIVE instead.
     */
    @Transactional
    public void deleteContractor(Long id) {
        Contractor contractor = getContractorById(id);
        boolean hasHistory = !packageRepository.findByContractorId(id).isEmpty()
                || !billRepository.findByContractorIdOrderByIdDesc(id).isEmpty();
        if (hasHistory) {
            contractor.setStatus("INACTIVE");
            contractorRepository.save(contractor);
            return;
        }
        contractorRepository.delete(contractor);
    }

    @Transactional
    public Contractor updateStatus(Long id, String status, String reason) {
        Contractor contractor = getContractorById(id);
        contractor.setStatus(status);
        if (reason != null) contractor.setNotes(reason);
        return contractorRepository.save(contractor);
    }

    // =====================================================================
    // Child records
    // =====================================================================

    @Transactional
    public ContractorProject addProject(Long contractorId, ContractorProject cp) {
        Contractor contractor = getContractorById(contractorId);
        cp.setContractor(contractor);
        if (cp.getAssignedDate() == null) cp.setAssignedDate(LocalDate.now());
        return contractorProjectRepository.save(cp);
    }

    @Transactional
    public ContractorAttendance addAttendance(Long contractorId, ContractorAttendance attendance) {
        Contractor contractor = getContractorById(contractorId);
        attendance.setContractor(contractor);
        return attendanceRepository.save(attendance);
    }

    @Transactional
    public ContractorPayment addPayment(Long contractorId, ContractorPayment payment) {
        Contractor contractor = getContractorById(contractorId);
        payment.setContractor(contractor);
        return paymentRepository.save(payment);
    }

    public List<ContractorDocument> getDocuments(Long contractorId) {
        return documentRepository.findByContractorId(contractorId);
    }

    @Transactional
    public ContractorDocument addDocument(Long contractorId, ContractorDocument document) {
        Contractor contractor = getContractorById(contractorId);
        document.setContractor(contractor);
        return documentRepository.save(document);
    }

    @Transactional
    public ContractorDocument verifyDocument(Long documentId, User currentUser) {
        ContractorDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));
        document.setVerified(true);
        document.setVerifiedBy(currentUser);
        document.setVerifiedAt(LocalDateTime.now());
        return documentRepository.save(document);
    }

    @Transactional
    public void deleteDocument(Long documentId) {
        documentRepository.deleteById(documentId);
    }

    // =====================================================================
    // Performance & compliance
    // =====================================================================

    /** Contractor performance card: delivery, quality, safety and money, in one shape. */
    public Map<String, Object> getPerformance(Long contractorId) {
        Contractor contractor = getContractorById(contractorId);
        List<ContractorWorkPackage> packages = packageRepository.findByContractorId(contractorId);
        LocalDate today = LocalDate.now();

        long total = packages.size();
        long completed = packages.stream().filter(p -> "COMPLETED".equals(p.getStatus())).count();
        long inProgress = packages.stream()
                .filter(p -> "IN_PROGRESS".equals(p.getStatus()) || "ACCEPTED".equals(p.getStatus())).count();
        long delayed = packages.stream()
                .filter(p -> p.getEndDate() != null && p.getEndDate().isBefore(today)
                        && !"COMPLETED".equals(p.getStatus()) && !"CANCELLED".equals(p.getStatus()))
                .count();
        long onTime = packages.stream()
                .filter(p -> "COMPLETED".equals(p.getStatus()))
                .filter(p -> p.getEndDate() == null || p.getActualEndDate() == null
                        || !p.getActualEndDate().isAfter(p.getEndDate()))
                .count();

        Map<String, Object> performance = new LinkedHashMap<>();
        performance.put("contractorId", contractorId);
        performance.put("contractorName", contractor.getName());
        performance.put("trade", contractor.getTrade());
        performance.put("totalPackages", total);
        performance.put("completedPackages", completed);
        performance.put("inProgressPackages", inProgress);
        performance.put("delayedPackages", delayed);
        performance.put("onTimeDeliveryPercent", completed == 0 ? 0 : Math.round(onTime * 100.0 / completed));
        performance.put("qualityRating", contractor.getRatingQuality());
        performance.put("timelinessRating", contractor.getRatingTimeliness());
        performance.put("safetyRating", contractor.getRatingSafety());
        performance.put("overallRating", contractor.getOverallRating());
        performance.put("safetyIncidents",
                safetyRepository.countByContractorIdAndRecordType(contractorId, "INCIDENT"));
        performance.put("safetyViolations",
                safetyRepository.countByContractorIdAndRecordType(contractorId, "VIOLATION"));
        performance.put("materialIssuedValue", nz(materialIssueRepository.sumIssuedValueByContractor(contractorId)));
        performance.put("totalBilled", packages.stream().map(p -> nz(p.getBilledAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        performance.put("totalPaid", nz(paymentRepository.sumPaidByContractor(contractorId)));
        return performance;
    }

    /**
     * Recomputes the timeliness rating from delivered packages and refreshes the overall rating.
     * Called after a package completes, so ratings track reality instead of manual entry.
     */
    @Transactional
    public Contractor refreshTimelinessRating(Long contractorId) {
        Contractor contractor = getContractorById(contractorId);
        List<ContractorWorkPackage> completed = packageRepository.findByContractorId(contractorId).stream()
                .filter(p -> "COMPLETED".equals(p.getStatus()))
                .filter(p -> p.getEndDate() != null && p.getActualEndDate() != null)
                .toList();
        if (completed.isEmpty()) return contractor;

        long onTime = completed.stream().filter(p -> !p.getActualEndDate().isAfter(p.getEndDate())).count();
        // 100% on time = 5.0, 0% = 1.0.
        BigDecimal rating = BigDecimal.valueOf(1 + (onTime * 4.0 / completed.size()))
                .setScale(2, java.math.RoundingMode.HALF_UP);
        contractor.setRatingTimeliness(rating);
        contractor.setOverallRating(ContractorExecutionService.averageRating(contractor));
        return contractorRepository.save(contractor);
    }

    /**
     * Project-wise payment rollup for a contractor: contract value (Σ approved work-package cost),
     * paid, pending and status per project. Derived from the existing work-package figures — Project
     * decides the scope value, so HR only reads it here.
     */
    public List<Map<String, Object>> getProjectWisePayments(Long contractorId) {
        Map<Long, Map<String, Object>> byProject = new LinkedHashMap<>();
        for (ContractorWorkPackage wp : packageRepository.findByContractorId(contractorId)) {
            if (wp.getProject() == null) continue;
            Long pid = wp.getProject().getId();
            Map<String, Object> row = byProject.computeIfAbsent(pid, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("projectId", pid);
                m.put("projectName", wp.getProject().getProjectName());
                m.put("contractValue", BigDecimal.ZERO);
                m.put("paid", BigDecimal.ZERO);
                return m;
            });
            BigDecimal cv = wp.getApprovedCost() != null && wp.getApprovedCost().signum() > 0
                    ? wp.getApprovedCost() : nz(wp.getEstimatedCost());
            row.put("contractValue", ((BigDecimal) row.get("contractValue")).add(cv));
            row.put("paid", ((BigDecimal) row.get("paid")).add(nz(wp.getPaidAmount())));
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : byProject.values()) {
            BigDecimal cv = (BigDecimal) row.get("contractValue");
            BigDecimal paid = (BigDecimal) row.get("paid");
            BigDecimal pending = cv.subtract(paid).max(BigDecimal.ZERO);
            row.put("pending", pending);
            row.put("status", pending.signum() <= 0 ? "PAID" : (paid.signum() > 0 ? "PARTIAL" : "PENDING"));
            out.add(row);
        }
        return out;
    }

    /** Agreements, insurance and licences lapsing inside the alert window. */
    public Map<String, Object> getComplianceAlerts() {
        LocalDate cutoff = LocalDate.now().plusDays(COMPLIANCE_WINDOW_DAYS);
        Map<String, Object> alerts = new LinkedHashMap<>();
        alerts.put("windowDays", COMPLIANCE_WINDOW_DAYS);
        alerts.put("contractors", contractorRepository.findWithExpiringCompliance(cutoff));
        alerts.put("documents", documentRepository.findExpiringBefore(cutoff));
        return alerts;
    }

    private Map<String, Object> buildOutstanding(Long contractorId) {
        Map<String, Object> outstanding = new LinkedHashMap<>();
        outstanding.put("billedOutstanding", nz(billRepository.sumOutstandingByContractor(contractorId)));
        outstanding.put("retentionHeld", nz(billRepository.sumRetentionByContractor(contractorId)));
        outstanding.put("totalPaid", nz(paymentRepository.sumPaidByContractor(contractorId)));
        outstanding.put("advancesPaid", nz(paymentRepository.sumAdvancesByContractor(contractorId)));
        outstanding.put("ledgerBalance", ledgerService.getBalance(contractorId));
        return outstanding;
    }

    private String nextContractorCode(Long id) {
        String candidate = String.format("CON-%06d", id);
        while (contractorRepository.existsByContractorCode(candidate)) {
            candidate = "CON-" + System.currentTimeMillis();
        }
        return candidate;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
