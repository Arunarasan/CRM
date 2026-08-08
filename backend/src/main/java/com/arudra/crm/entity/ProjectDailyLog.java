package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "project_daily_logs", indexes = {
    @Index(name = "idx_pdl_project", columnList = "project_id")
})
public class ProjectDailyLog extends BaseEntity {

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @Column(name = "percentage_completed")
    private Integer percentageCompleted = 0;

    @Column(name = "work_completed", columnDefinition = "TEXT")
    private String workCompleted;

    @Column(name = "work_pending", columnDefinition = "TEXT")
    private String workPending;

    @Column(columnDefinition = "TEXT")
    private String issues;

    @Column(columnDefinition = "TEXT")
    private String risks;

    @Column(length = 200)
    private String weather;

    private Integer manpower = 0;

    @Column(columnDefinition = "TEXT")
    private String equipment;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by_id")
    private User reportedBy;
}
