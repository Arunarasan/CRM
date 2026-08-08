package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** A single progress report an employee logs against a task while executing it. */
@Getter
@Setter
@Entity
@Table(name = "task_progress_updates")
public class TaskProgressUpdate extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private User employee;

    @Column(name = "progress_percent")
    private Integer progressPercent;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "time_spent_minutes")
    private Integer timeSpentMinutes;

    @OneToMany(mappedBy = "progressUpdate", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TaskProgressMedia> media;
}
