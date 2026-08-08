package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Attendance line for a single employee within a ProjectDailyLog entry. */
@Getter
@Setter
@Entity
@Table(name = "project_daily_log_employees")
public class ProjectDailyLogEmployee extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_log_id", nullable = false)
    private ProjectDailyLog dailyLog;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User employee;

    @Column(nullable = false)
    private Boolean present = true;

    @Column(name = "hours_worked")
    private Double hoursWorked;
}
