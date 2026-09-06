package com.arudra.crm.service;

import com.arudra.crm.entity.DailyReport;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.Lead;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.DailyReportRepository;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.repository.LeadRepository;
import com.arudra.crm.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin/manager side of the employee {@link DailyReport} stream. The portal writes reports
 * (see {@link EmployeePortalService#createDailyReport}); this service is the read + review side
 * for HR/management. Reports are keyed by {@code users.id} on the assignment layer, so anything
 * addressed by an {@link Employee} master id is bridged to the user by shared email.
 */
@Service
public class DailyReportService {

    @Autowired private DailyReportRepository dailyReportRepository;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private LeadRepository leadRepository;
    @Autowired private NotificationService notificationService;

    /**
     * {@code employeeId} is the {@link Employee} master id (what the HR pickers use); reports are
     * keyed by {@code users.id}, so it is bridged to the linked user here. An employee with no
     * linked login has no reports — return empty rather than falling through to "all".
     */
    public List<DailyReport> search(Long employeeId, Long projectId, Long leadId,
                                    String status, LocalDate from, LocalDate to) {
        Long userId = null;
        if (employeeId != null) {
            userId = userIdForEmployee(employeeId);
            if (userId == null) return List.of();
        }
        return dailyReportRepository.search(userId, projectId, leadId, status, from, to);
    }

    public DailyReport get(Long id) {
        return dailyReportRepository.findById(id)
                .filter(r -> !Boolean.TRUE.equals(r.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Daily report not found."));
    }

    public List<DailyReport> byProject(Long projectId) {
        return dailyReportRepository.findByProjectIdAndIsDeletedFalseOrderByReportDateDescIdDesc(projectId);
    }

    public List<DailyReport> byLead(Long leadId) {
        return dailyReportRepository.findByLeadIdAndIsDeletedFalseOrderByReportDateDescIdDesc(leadId);
    }

    /** Reports submitted by the employee behind this master record (resolved user by email). */
    public List<DailyReport> forEmployee(Long employeeId) {
        Long userId = userIdForEmployee(employeeId);
        if (userId == null) return List.of();
        return dailyReportRepository.findByEmployeeIdAndIsDeletedFalseOrderByReportDateDescIdDesc(userId);
    }

    /** Compact list of the leads this employee raised (for the HR profile "Leads" tab). */
    public List<Map<String, Object>> leadsForEmployee(Long employeeId) {
        Long userId = userIdForEmployee(employeeId);
        if (userId == null) return List.of();
        return leadRepository.findByLeadOwnerIdAndIsDeletedFalseOrderByIdDesc(userId)
                .stream().map(this::leadSummary).toList();
    }

    /**
     * Marks a report reviewed and records the manager's comment, then notifies the reporting
     * employee that their submission was seen.
     */
    @Transactional
    public DailyReport review(Long id, String managerComment, User reviewer) {
        DailyReport report = get(id);
        if (managerComment != null && !managerComment.isBlank()) {
            report.setManagerComment(managerComment.trim());
        }
        report.setStatus("REVIEWED");
        DailyReport saved = dailyReportRepository.save(report);
        if (saved.getEmployee() != null) {
            notificationService.dispatch("Daily report reviewed",
                    "Your report for " + saved.getReportDate() + " was reviewed"
                            + (managerComment != null && !managerComment.isBlank() ? ": " + managerComment.trim() : "."),
                    "DAILY_REPORT", saved.getEmployee().getId(), "/employee/daily-reports");
        }
        return saved;
    }

    /** Roll-up used by the Reports Hub: this-month volume, pending review, and a per-employee breakdown. */
    public Map<String, Object> summary() {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        List<DailyReport> thisMonth = dailyReportRepository.search(null, null, null, null, monthStart, today);

        Map<String, Long> byEmployee = new LinkedHashMap<>();
        long thisWeek = 0;
        for (DailyReport r : thisMonth) {
            String name = r.getEmployee() != null && r.getEmployee().getName() != null
                    ? r.getEmployee().getName() : "Unknown";
            byEmployee.merge(name, 1L, Long::sum);
            if (r.getReportDate() != null && !r.getReportDate().isBefore(weekStart)) thisWeek++;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalThisMonth", thisMonth.size());
        out.put("totalThisWeek", thisWeek);
        out.put("pendingReview", dailyReportRepository.countByIsDeletedFalseAndStatus("SUBMITTED"));
        out.put("byEmployee", byEmployee);
        out.put("recent", thisMonth.stream().limit(5).map(this::reportSummary).toList());
        return out;
    }

    // --- helpers -----------------------------------------------------------

    private Long userIdForEmployee(Long employeeId) {
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        if (emp.getEmail() == null || emp.getEmail().isBlank()) return null;
        return userRepository.findByEmail(emp.getEmail()).map(User::getId).orElse(null);
    }

    private Map<String, Object> reportSummary(DailyReport r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("reportDate", r.getReportDate());
        m.put("employeeName", r.getEmployee() != null ? r.getEmployee().getName() : null);
        m.put("projectName", r.getProject() != null ? r.getProject().getProjectName() : null);
        m.put("todaysWork", r.getTodaysWork());
        m.put("status", r.getStatus());
        return m;
    }

    private Map<String, Object> leadSummary(Lead l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("leadNumber", l.getLeadNumber());
        m.put("name", l.getName());
        m.put("mobileNumber", l.getMobileNumber());
        m.put("city", l.getCity());
        m.put("status", l.getStatus());
        m.put("stage", l.getStage());
        m.put("leadSource", l.getLeadSource());
        m.put("requirementCategory", l.getRequirementCategory());
        m.put("estimatedBudget", l.getEstimatedBudget());
        m.put("isConverted", l.getIsConverted());
        m.put("createdAt", l.getCreatedAt());
        return m;
    }
}
