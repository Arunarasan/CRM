package com.arudra.crm.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
public class DashboardSummaryDTO {

    // Top metrics
    private long totalCustomers;
    private long totalLeads;
    private long activeProjects;
    private long pendingTasks;
    private BigDecimal totalRevenue; // Sum of all APPROVED quotations

    // Charts data
    private List<RevenueData> revenueData; // Monthly revenue
    private List<LeadStatusData> leadPipeline; // Leads grouped by status

    // Lists
    private List<TaskSummary> todaysTasks;
    private List<LeadFollowUp> todaysFollowUps;
    private List<ProjectProgress> activeProjectProgress;
    private List<RecentCustomer> recentCustomers;

    @Data
    public static class RevenueData {
        private String month;
        private BigDecimal revenue;
        
        public RevenueData(String month, BigDecimal revenue) {
            this.month = month;
            this.revenue = revenue;
        }
    }

    @Data
    public static class LeadStatusData {
        private String name;
        private long value;

        public LeadStatusData(String name, long value) {
            this.name = name;
            this.value = value;
        }
    }

    @Data
    public static class TaskSummary {
        private Long id;
        private String title;
        private String status;
        private String priority;
    }

    @Data
    public static class LeadFollowUp {
        private Long id;
        private String customerName;
        private String status;
    }

    @Data
    public static class ProjectProgress {
        private Long id;
        private String name;
        private int progress;
        private LocalDate endDate;
    }

    @Data
    public static class RecentCustomer {
        private Long id;
        private String name;
        private String company;
        private String email;
    }
}
