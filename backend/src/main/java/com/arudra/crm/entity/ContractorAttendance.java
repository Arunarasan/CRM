package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Labour deployment for a contractor on a given day, scoped to a work package where known.
 * Worker counts feed the attendance report and per-day rate billing.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_attendance", indexes = {
    @Index(name = "idx_cat_date", columnList = "date"),
    @Index(name = "idx_cat_package", columnList = "work_package_id")
})
public class ContractorAttendance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "phase", "room", "boq"})
    private ContractorWorkPackage workPackage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation",
            "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 50)
    private String status; // PRESENT, ABSENT, HALF_DAY

    @Column(name = "hours_worked", precision = 5, scale = 2)
    private BigDecimal hoursWorked;

    @Column(name = "workers_count")
    private Integer workersCount;

    @Column(name = "skilled_count")
    private Integer skilledCount;

    @Column(name = "unskilled_count")
    private Integer unskilledCount;

    @Column(name = "supervisor_name", length = 150)
    private String supervisorName;

    @Column(name = "in_time")
    private LocalTime inTime;

    @Column(name = "out_time")
    private LocalTime outTime;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User recordedBy;
}
