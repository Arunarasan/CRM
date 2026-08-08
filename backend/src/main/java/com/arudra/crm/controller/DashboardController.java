package com.arudra.crm.controller;

import com.arudra.crm.dto.DashboardSummaryDTO;
import com.arudra.crm.repository.*;
import com.arudra.crm.entity.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.arudra.crm.dto.ApiResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = "*")
public class DashboardController {

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

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<DashboardSummaryDTO>> getDashboardSummary() {
        DashboardSummaryDTO summary = new DashboardSummaryDTO();
        
        // 1. Top Metrics
        summary.setTotalCustomers(customerRepository.count());
        summary.setTotalLeads(leadRepository.count());
        summary.setActiveProjects(projectRepository.countByStatus("RUNNING"));
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

        List<DashboardSummaryDTO.ProjectProgress> activeProjects = projectRepository.findByStatus("RUNNING").stream().map(p -> {
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
