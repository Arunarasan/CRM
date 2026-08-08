package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** An employee's end-of-day work report, optionally tied to a project/task. */
@Getter
@Setter
@Entity
@Table(name = "daily_reports", indexes = {
    @Index(name = "idx_dr_employee", columnList = "employee_id"),
    @Index(name = "idx_dr_date", columnList = "report_date")
})
public class DailyReport extends BaseEntity {

    // Assignment layer: keyed by users.id (matches task execution tables).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "assignedEmployee", "contractor", "phase", "room", "parentTask", "dependencies"})
    private Task task;

    @Column(name = "report_date", nullable = false)
    private LocalDate reportDate;

    @Column(name = "todays_work", columnDefinition = "TEXT")
    private String todaysWork;

    @Column(name = "hours_worked", precision = 5, scale = 2)
    private BigDecimal hoursWorked;

    @Column(name = "completed_work", columnDefinition = "TEXT")
    private String completedWork;

    @Column(name = "pending_work", columnDefinition = "TEXT")
    private String pendingWork;

    @Column(columnDefinition = "TEXT")
    private String problems;

    @Column(name = "material_used", columnDefinition = "TEXT")
    private String materialUsed;

    @Column(name = "material_required", columnDefinition = "TEXT")
    private String materialRequired;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "manager_comment", columnDefinition = "TEXT")
    private String managerComment;

    @Column(nullable = false, length = 20)
    private String status = "SUBMITTED"; // SUBMITTED, REVIEWED

    @OneToMany(mappedBy = "report", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DailyReportMedia> media = new ArrayList<>();
}
