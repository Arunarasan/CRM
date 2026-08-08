package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A contractor's daily work report against a package. Verifying a report rolls its
 * completion percentage up to the work package, phase and project.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_daily_progress", indexes = {
    @Index(name = "idx_cdp_package", columnList = "work_package_id"),
    @Index(name = "idx_cdp_project_date", columnList = "project_id, progress_date"),
    @Index(name = "idx_cdp_date", columnList = "progress_date")
})
public class ContractorDailyProgress extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "phase", "room", "boq"})
    private ContractorWorkPackage workPackage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation",
            "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @Column(name = "progress_date", nullable = false)
    private LocalDate progressDate = LocalDate.now();

    @Column(name = "work_done", columnDefinition = "TEXT")
    private String workDone;

    @Column(name = "completion_percentage", nullable = false)
    private Integer completionPercentage = 0;

    @Column(name = "quantity_completed", precision = 15, scale = 2)
    private BigDecimal quantityCompleted;

    @Column(length = 20)
    private String unit;

    @Column(name = "workers_count")
    private Integer workersCount;

    @Column(name = "supervisor_name", length = 150)
    private String supervisorName;

    @Column(columnDefinition = "TEXT")
    private String issues;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(length = 50)
    private String weather;

    @Column(nullable = false, length = 30)
    private String status = "SUBMITTED"; // SUBMITTED, VERIFIED, REJECTED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User reportedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;
}
