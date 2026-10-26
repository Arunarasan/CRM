package com.arudra.crm.controller;

import com.arudra.crm.dto.DashboardSummaryDTO;
import com.arudra.crm.repository.*;
import com.arudra.crm.entity.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.arudra.crm.dto.ApiResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    // The summary aggregates company-wide revenue, pipeline and customer data — an office/
    // management overview, not something every authenticated user (e.g. field employees on the
    // mobile portal) should read.
    private static final String OFFICE =
            "hasAuthority('ROLE_ADMIN')";

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private LeadRepository leadRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private QuotationRepository quotationRepository;

    @Autowired
    private com.arudra.crm.service.ProjectService projectService;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private com.arudra.crm.service.ProjectWorkService projectWorkService;


    @GetMapping("/summary")
    @PreAuthorize(OFFICE)
    public ResponseEntity<ApiResponse<DashboardSummaryDTO>> getDashboardSummary() {
        DashboardSummaryDTO summary = new DashboardSummaryDTO();
        
        // 1. Top Metrics
        summary.setTotalCustomers(customerRepository.count());
        summary.setTotalLeads(leadRepository.count());
        summary.setActiveProjects(projectRepository.countActive());
        summary.setPendingTasks(taskRepository.countByStatus("PENDING"));
        
        BigDecimal totalRev = quotationRepository.sumTotalRevenue();
        summary.setTotalRevenue(totalRev != null ? totalRev : BigDecimal.ZERO);

        // 2. Charts Data
        List<Object[]> monthlyRevRaw = quotationRepository.getMonthlyRevenue();
        List<DashboardSummaryDTO.RevenueData> revData = monthlyRevRaw.stream()
                .map(obj -> new DashboardSummaryDTO.RevenueData((String) obj[0], (BigDecimal) obj[1]))
                .collect(Collectors.toList());
        summary.setRevenueData(revData);

        List<Object[]> leadStatusRaw = leadRepository.countLeadsByStatus();
        List<DashboardSummaryDTO.LeadStatusData> leadData = leadStatusRaw.stream()
                .map(obj -> new DashboardSummaryDTO.LeadStatusData((String) obj[0], ((Number) obj[1]).longValue()))
                .collect(Collectors.toList());
        summary.setLeadPipeline(leadData);

        // 2b. Card breakdowns
        summary.setNewLeadsToday(leadRepository.countCreatedSince(LocalDate.now().atStartOfDay()));
        long leadsInProgress = leadRepository.countNeedingFollowUp(LocalDate.now());
        summary.setLeadsInProgress(leadsInProgress);

        long readyToFit = 0;
        for (Project p : projectRepository.findActive()) {
            try {
                // Same rule as the Projects page's Stage column: execution done, installation still open.
                if ("READY_TO_FIT".equals(projectWorkService.portfolioSummary(p.getId()).get("stage"))) readyToFit++;
            } catch (RuntimeException ignored) {
                // one bad project must not break the dashboard
            }
        }
        summary.setProjectsReadyToFit(readyToFit);
        summary.setProjectsInProgress(Math.max(0, summary.getActiveProjects() - readyToFit));

        // Completed projects not fully paid (value minus verified payments, or open invoices)
        java.util.Map<Long, BigDecimal> owed = projectService.completedPending();
        summary.setCompletedPaymentPendingCount(owed.size());
        summary.setCompletedPaymentPendingAmount(owed.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add));

        // Attendance today (active employees only)
        long totalEmp = employeeRepository.countByStatusAndIsDeletedFalse("ACTIVE");
        long present = 0, leave = 0;
        for (Object[] row : attendanceRepository.countByStatusForDate(LocalDate.now())) {
            String st = String.valueOf(row[0]).toUpperCase();
            long n = ((Number) row[1]).longValue();
            if ("PRESENT".equals(st) || "HALF_DAY".equals(st)) present += n;
            else if ("LEAVE".equals(st)) leave += n;
        }
        summary.setTotalEmployees(totalEmp);
        summary.setPresentToday(present);
        summary.setOnLeaveToday(leave);
        summary.setAbsentToday(Math.max(0, totalEmp - present - leave));

        // 3. Lists
        LocalDate today = LocalDate.now();
        
        List<DashboardSummaryDTO.TaskSummary> todaysTasks = taskRepository.findTasksDueToday(today).stream().map(t -> {
            DashboardSummaryDTO.TaskSummary ts = new DashboardSummaryDTO.TaskSummary();
            ts.setId(t.getId());
            ts.setTitle(t.getTaskName());
            ts.setStatus(t.getStatus());
            ts.setPriority(t.getPriority());
            return ts;
        }).collect(Collectors.toList());
        summary.setTodaysTasks(todaysTasks);

        List<DashboardSummaryDTO.LeadFollowUp> todaysFollowUps = leadRepository.findLeadsForFollowUp(today).stream().map(l -> {
            DashboardSummaryDTO.LeadFollowUp lf = new DashboardSummaryDTO.LeadFollowUp();
            lf.setId(l.getId());
            lf.setCustomerName(l.getName());
            lf.setStatus(l.getStatus());
            return lf;
        }).collect(Collectors.toList());
        summary.setTodaysFollowUps(todaysFollowUps);

        List<DashboardSummaryDTO.ProjectProgress> activeProjects = projectRepository.findActive().stream().map(p -> {
            DashboardSummaryDTO.ProjectProgress pp = new DashboardSummaryDTO.ProjectProgress();
            pp.setId(p.getId());
            pp.setName(p.getProjectName());
            pp.setProgress(p.getProgress());
            pp.setEndDate(p.getEndDate());
            return pp;
        }).collect(Collectors.toList());
        summary.setActiveProjectProgress(activeProjects);

        List<DashboardSummaryDTO.RecentCustomer> recentCustomers = customerRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 5)).stream().map(c -> {
            DashboardSummaryDTO.RecentCustomer rc = new DashboardSummaryDTO.RecentCustomer();
            rc.setId(c.getId());
            rc.setName(c.getName());
            rc.setCompany(c.getCity());
            rc.setEmail(c.getEmail());
            return rc;
        }).collect(Collectors.toList());
        summary.setRecentCustomers(recentCustomers);

        return ResponseEntity.ok(ApiResponse.success(summary));
    }
}
