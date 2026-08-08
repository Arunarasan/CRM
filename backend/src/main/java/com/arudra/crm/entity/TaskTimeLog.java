package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

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
}
