package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Contractor dashboard and reports. Rows are plain {@code Map}s, matching the shape the
 * existing report controllers return so the frontend table components stay reusable.
 */
@Service
public class ContractorReportService {

    @Autowired private ContractorRepository contractorRepository;
    @Autowired private ContractorWorkPackageRepository packageRepository;
    @Autowired private WorkPackageAssignmentRepository assignmentRepository;
    @Autowired private ContractorBillRepository billRepository;
    @Autowired private ContractorPaymentRepository paymentRepository;
    @Autowired private ContractorDailyProgressRepository progressRepository;
    @Autowired private ContractorQualityInspectionRepository inspectionRepository;
    @Autowired private ContractorAttendanceRepository attendanceRepository;
    @Autowired private ContractorMaterialIssueItemRepository issueItemRepository;
    @Autowired private ContractorSafetyRecordRepository safetyRepository;
    @Autowired private ContractorLedgerService ledgerService;

    // =====================================================================
    // Dashboard
    // =====================================================================

    public Map<String, Object> getDashboard() {
        LocalDate today = LocalDate.now();
        List<Contractor> contractors = contractorRepository.findAll();
        List<ContractorWorkPackage> packages = packageRepository.findAll();

        long activePackages = packages.stream()
                .filter(p -> List.of("ASSIGNED", "ACCEPTED", "IN_PROGRESS", "REWORK", "INSPECTION_PENDING")
                        .contains(p.getStatus()))
                .count();
        long delayedPackages = packageRepository.findDelayed(today).size();

        List<ContractorBill> pendingBills = billRepository.findPendingApproval();
        List<ContractorBill> payableBills = billRepository.findPayable();

        BigDecimal pendingBillValue = pendingBills.stream().map(b -> nz(b.getNetAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal payableValue = payableBills.stream().map(b -> nz(b.getBalanceAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal retentionHeld = contractors.stream()
                .map(c -> nz(billRepository.sumRetentionByContractor(c.getId())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<ContractorDailyProgress> todaysProgress = progressRepository.findByProgressDateOrderByIdDesc(today);
        Long workersToday = attendanceRepository.totalWorkersOn(today);

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("totalContractors", contractors.size());
        dashboard.put("activeContractors", contractors.stream()
                .filter(c -> "ACTIVE".equals(c.getStatus())).count());
        dashboard.put("engagedContractors", assignmentRepository.countActiveContractors());
        dashboard.put("totalWorkPackages", packages.size());
        dashboard.put("activeWorkPackages", activePackages);
        dashboard.put("completedWorkPackages", packages.stream()
                .filter(p -> "COMPLETED".equals(p.getStatus())).count());
        dashboard.put("delayedWorkPackages", delayedPackages);
        dashboard.put("pendingBills", pendingBills.size());
        dashboard.put("pendingBillValue", pendingBillValue);
        dashboard.put("pendingPayments", payableBills.size());
        dashboard.put("pendingPaymentValue", payableValue);
        dashboard.put("retentionHeld", retentionHeld);
        dashboard.put("todaysProgressReports", todaysProgress.size());
        dashboard.put("workersOnSiteToday", workersToday == null ? 0 : workersToday);
        dashboard.put("openQualityIssues", inspectionRepository.countOpenQualityIssues());
        dashboard.put("statusBreakdown", countBy(packages, ContractorWorkPackage::getStatus));
        dashboard.put("tradeBreakdown", countBy(packages, ContractorWorkPackage::getTrade));
        return dashboard;
    }

    // =====================================================================
    // Reports
    // =====================================================================

    /** Contractor Performance: delivery, quality, safety, value. */
    public List<Map<String, Object>> reportPerformance() {
        List<Map<String, Object>> rows = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (Contractor contractor : contractorRepository.findAll()) {
            List<ContractorWorkPackage> packages = packageRepository.findByContractorId(contractor.getId());
            if (packages.isEmpty() && nz(contractor.getOverallRating()).signum() == 0) continue;

            long completed = packages.stream().filter(p -> "COMPLETED".equals(p.getStatus())).count();
            long delayed = packages.stream()
                    .filter(p -> p.getEndDate() != null && p.getEndDate().isBefore(today)
                            && !"COMPLETED".equals(p.getStatus()) && !"CANCELLED".equals(p.getStatus()))
                    .count();
            long onTime = packages.stream()
                    .filter(p -> "COMPLETED".equals(p.getStatus()))
                    .filter(p -> p.getEndDate() == null || p.getActualEndDate() == null
                            || !p.getActualEndDate().isAfter(p.getEndDate()))
                    .count();

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("contractorId", contractor.getId());
            row.put("contractorCode", contractor.getContractorCode());
            row.put("contractorName", contractor.getName());
            row.put("trade", contractor.getTrade());
            row.put("totalPackages", packages.size());
            row.put("completedPackages", completed);
            row.put("delayedPackages", delayed);
            row.put("onTimePercent", completed == 0 ? 0 : Math.round(onTime * 100.0 / completed));
            row.put("qualityRating", contractor.getRatingQuality());
            row.put("safetyRating", contractor.getRatingSafety());
            row.put("overallRating", contractor.getOverallRating());
            row.put("totalBilled", packages.stream().map(p -> nz(p.getBilledAmount()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add));
            row.put("status", contractor.getStatus());
            rows.add(row);
        }
        rows.sort((a, b) -> compareRatings(b.get("overallRating"), a.get("overallRating")));
        return rows;
    }

    /** Delayed Works: packages past their end date, with the contractor on the hook. */
    public List<Map<String, Object>> reportDelayedWorks() {
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (ContractorWorkPackage wp : packageRepository.findDelayed(today)) {
            Map<String, Object> row = basePackageRow(wp);
            row.put("daysDelayed", ChronoUnit.DAYS.between(wp.getEndDate(), today));
            row.put("completionPercentage", wp.getCompletionPercentage());
            row.put("contractors", contractorNames(wp.getId()));
            rows.add(row);
        }
        rows.sort((a, b) -> Long.compare((Long) b.get("daysDelayed"), (Long) a.get("daysDelayed")));
        return rows;
    }

    /** Cost Analysis: estimated vs approved vs billed vs paid per package. */
    public List<Map<String, Object>> reportCostAnalysis(Long projectId) {
        List<ContractorWorkPackage> packages = projectId == null
                ? packageRepository.findAll()
                : packageRepository.findByProjectIdOrderByIdDesc(projectId);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (ContractorWorkPackage wp : packages) {
            Map<String, Object> row = basePackageRow(wp);
            row.put("estimatedCost", nz(wp.getEstimatedCost()));
            row.put("approvedCost", nz(wp.getApprovedCost()));
            row.put("billedAmount", nz(wp.getBilledAmount()));
            row.put("paidAmount", nz(wp.getPaidAmount()));
            row.put("outstanding", wp.getOutstandingAmount());
            BigDecimal variance = nz(wp.getBilledAmount()).subtract(nz(wp.getEstimatedCost()));
            row.put("variance", variance);
            row.put("variancePercent", nz(wp.getEstimatedCost()).signum() == 0 ? null
                    : variance.multiply(BigDecimal.valueOf(100))
                            .divide(nz(wp.getEstimatedCost()), 2, RoundingMode.HALF_UP));
            row.put("contractors", contractorNames(wp.getId()));
            rows.add(row);
        }
        return rows;
    }

    /** Payment Summary: what each contractor was billed, paid and still holds in retention. */
    public List<Map<String, Object>> reportPaymentSummary() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Contractor contractor : contractorRepository.findAll()) {
            BigDecimal outstanding = nz(billRepository.sumOutstandingByContractor(contractor.getId()));
            BigDecimal paid = nz(paymentRepository.sumPaidByContractor(contractor.getId()));
            BigDecimal retention = nz(billRepository.sumRetentionByContractor(contractor.getId()));
            BigDecimal advances = nz(paymentRepository.sumAdvancesByContractor(contractor.getId()));
            if (outstanding.signum() == 0 && paid.signum() == 0 && retention.signum() == 0) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("contractorId", contractor.getId());
            row.put("contractorCode", contractor.getContractorCode());
            row.put("contractorName", contractor.getName());
            row.put("trade", contractor.getTrade());
            row.put("advancesPaid", advances);
            row.put("totalPaid", paid);
            row.put("outstanding", outstanding);
            row.put("retentionHeld", retention);
            row.put("ledgerBalance", ledgerService.getBalance(contractor.getId()));
            rows.add(row);
        }
        rows.sort((a, b) -> ((BigDecimal) b.get("outstanding")).compareTo((BigDecimal) a.get("outstanding")));
        return rows;
    }

    /** Outstanding Bills: everything awaiting approval or payment, oldest first. */
    public List<Map<String, Object>> reportOutstandingBills() {
        List<Map<String, Object>> rows = new ArrayList<>();
        List<ContractorBill> bills = new ArrayList<>(billRepository.findPendingApproval());
        bills.addAll(billRepository.findPayable());

        LocalDate today = LocalDate.now();
        for (ContractorBill bill : bills) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("billId", bill.getId());
            row.put("billNumber", bill.getBillNumber());
            row.put("billType", bill.getBillType());
            row.put("billDate", bill.getBillDate());
            row.put("ageDays", ChronoUnit.DAYS.between(bill.getBillDate(), today));
            row.put("contractorName", bill.getContractor().getName());
            row.put("projectName", bill.getProject() == null ? null : bill.getProject().getProjectName());
            row.put("workPackage", bill.getWorkPackage() == null ? null : bill.getWorkPackage().getPackageCode());
            row.put("netAmount", nz(bill.getNetAmount()));
            row.put("paidAmount", nz(bill.getPaidAmount()));
            row.put("balanceAmount", nz(bill.getBalanceAmount()));
            row.put("status", bill.getStatus());
            row.put("currentApprovalStage", bill.getCurrentApprovalStage());
            rows.add(row);
        }
        rows.sort((a, b) -> Long.compare((Long) b.get("ageDays"), (Long) a.get("ageDays")));
        return rows;
    }

    /** Material Consumption: what was issued to contractors and how it was accounted for. */
    public List<Map<String, Object>> reportMaterialConsumption(Long contractorId, Long projectId) {
        List<ContractorMaterialIssueItem> items;
        if (contractorId != null) {
            items = issueItemRepository.findByContractorId(contractorId);
        } else if (projectId != null) {
            items = issueItemRepository.findByProjectId(projectId);
        } else {
            items = issueItemRepository.findAll();
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (ContractorMaterialIssueItem item : items) {
            ContractorMaterialIssue issue = item.getIssue();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("issueNumber", issue.getIssueNumber());
            row.put("issueDate", issue.getIssueDate());
            row.put("contractorName", issue.getContractor().getName());
            row.put("projectName", issue.getProject().getProjectName());
            row.put("workPackage", issue.getWorkPackage().getPackageCode());
            row.put("material", item.getProduct().getName());
            row.put("unit", item.getUnit());
            row.put("issuedQuantity", item.getIssuedQuantity());
            row.put("returnedQuantity", item.getReturnedQuantity());
            row.put("consumedQuantity", item.getConsumedQuantity());
            row.put("wasteQuantity", item.getWasteQuantity());
            row.put("damagedQuantity", item.getDamagedQuantity());
            row.put("unreconciled", item.getUnreconciledQuantity());
            row.put("totalValue", item.getTotalValue());
            row.put("recoverableValue", item.getRecoverableValue());
            rows.add(row);
        }
        return rows;
    }

    /** Quality Report: every inspection with its outcome. */
    public List<Map<String, Object>> reportQuality(Long contractorId, Long projectId) {
        List<ContractorQualityInspection> inspections;
        if (contractorId != null) {
            inspections = inspectionRepository.findByContractorIdOrderByIdDesc(contractorId);
        } else if (projectId != null) {
            inspections = inspectionRepository.findByProjectIdOrderByIdDesc(projectId);
        } else {
            inspections = inspectionRepository.findAll();
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (ContractorQualityInspection inspection : inspections) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("inspectionNumber", inspection.getInspectionNumber());
            row.put("inspectionDate", inspection.getInspectionDate());
            row.put("inspectionType", inspection.getInspectionType());
            row.put("contractorName", inspection.getContractor().getName());
            row.put("projectName", inspection.getProject().getProjectName());
            row.put("workPackage", inspection.getWorkPackage().getPackageCode());
            row.put("result", inspection.getResult());
            row.put("score", inspection.getScore());
            row.put("defects", inspection.getDefects());
            row.put("reworkDueDate", inspection.getReworkDueDate());
            rows.add(row);
        }
        return rows;
    }

    /** Attendance Report: labour deployed per contractor over a date range. */
    public List<Map<String, Object>> reportAttendance(Long contractorId, LocalDate from, LocalDate to) {
        LocalDate start = from != null ? from : LocalDate.now().minusDays(30);
        LocalDate end = to != null ? to : LocalDate.now();

        List<Contractor> contractors = contractorId != null
                ? List.of(contractorRepository.findById(contractorId).orElseThrow())
                : contractorRepository.findAll();

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Contractor contractor : contractors) {
            List<ContractorAttendance> records =
                    attendanceRepository.findForContractorBetween(contractor.getId(), start, end);
            if (records.isEmpty()) continue;

            long presentDays = records.stream().filter(r -> "PRESENT".equals(r.getStatus())).count();
            long absentDays = records.stream().filter(r -> "ABSENT".equals(r.getStatus())).count();
            int totalWorkers = records.stream().mapToInt(r -> r.getWorkersCount() == null ? 0 : r.getWorkersCount()).sum();
            BigDecimal totalHours = records.stream().map(r -> nz(r.getHoursWorked()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("contractorId", contractor.getId());
            row.put("contractorName", contractor.getName());
            row.put("trade", contractor.getTrade());
            row.put("from", start);
            row.put("to", end);
            row.put("workingDays", presentDays);
            row.put("absentDays", absentDays);
            row.put("totalManDays", totalWorkers);
            row.put("totalHours", totalHours);
            row.put("averageWorkersPerDay", presentDays == 0 ? 0
                    : BigDecimal.valueOf(totalWorkers).divide(BigDecimal.valueOf(presentDays), 1, RoundingMode.HALF_UP));
            rows.add(row);
        }
        return rows;
    }

    /** Safety Report: PPE compliance, incidents and violations per contractor. */
    public List<Map<String, Object>> reportSafety(Long contractorId) {
        List<ContractorSafetyRecord> records = contractorId != null
                ? safetyRepository.findByContractorIdOrderByIdDesc(contractorId)
                : safetyRepository.findAll();

        List<Map<String, Object>> rows = new ArrayList<>();
        for (ContractorSafetyRecord record : records) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", record.getId());
            row.put("recordDate", record.getRecordDate());
            row.put("recordType", record.getRecordType());
            row.put("severity", record.getSeverity());
            row.put("contractorName", record.getContractor().getName());
            row.put("projectName", record.getProject() == null ? null : record.getProject().getProjectName());
            row.put("workPackage", record.getWorkPackage() == null ? null : record.getWorkPackage().getPackageCode());
            row.put("ppeCompliant", record.getPpeCompliant());
            row.put("description", record.getDescription());
            row.put("penaltyAmount", record.getPenaltyAmount());
            row.put("status", record.getStatus());
            rows.add(row);
        }
        return rows;
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private Map<String, Object> basePackageRow(ContractorWorkPackage wp) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("workPackageId", wp.getId());
        row.put("packageCode", wp.getPackageCode());
        row.put("packageName", wp.getPackageName());
        row.put("trade", wp.getTrade());
        row.put("status", wp.getStatus());
        row.put("projectId", wp.getProject().getId());
        row.put("projectName", wp.getProject().getProjectName());
        row.put("startDate", wp.getStartDate());
        row.put("endDate", wp.getEndDate());
        return row;
    }

    private String contractorNames(Long workPackageId) {
        return assignmentRepository.findByWorkPackageIdOrderByIdAsc(workPackageId).stream()
                .filter(a -> !"REJECTED".equals(a.getStatus()))
                .map(a -> a.getContractor().getName())
                .reduce((a, b) -> a + ", " + b)
                .orElse("Unassigned");
    }

    private static <T> Map<String, Long> countBy(List<T> items, java.util.function.Function<T, String> key) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (T item : items) {
            String k = key.apply(item);
            counts.merge(k == null ? "UNSPECIFIED" : k, 1L, Long::sum);
        }
        return counts;
    }

    private static int compareRatings(Object a, Object b) {
        BigDecimal left = a instanceof BigDecimal ? (BigDecimal) a : BigDecimal.ZERO;
        BigDecimal right = b instanceof BigDecimal ? (BigDecimal) b : BigDecimal.ZERO;
        return left.compareTo(right);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
