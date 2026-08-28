package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "task_time_logs")
public class TaskTimeLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private User employee;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "paused_at")
    private LocalDateTime pausedAt;
    
    @Column(name = "resumed_at")
    private LocalDateTime resumedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "working_time_minutes")
    private Integer workingTimeMinutes = 0;

    @Column(name = "break_time_minutes")
    private Integer breakTimeMinutes = 0;

    @Column(name = "overtime_minutes")
    private Integer overtimeMinutes = 0;

    // ---------------------------------------------------------------- approval lifecycle (V36)

    /** The calendar day this work belongs to (for timesheet grouping / payroll periods). */
    @Column(name = "work_date")
    private LocalDate workDate;

    /** DRAFT (tracked) → SUBMITTED (employee) → APPROVED | REJECTED (supervisor/admin). */
    @Column(name = "status", nullable = false, length = 20)
    private String status = "DRAFT";

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    private User approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "remarks", length = 500)
    private String remarks;
}
