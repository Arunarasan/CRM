package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "task_assignments", indexes = {
    @Index(name = "idx_ta_task", columnList = "task_id"),
    @Index(name = "idx_ta_employee", columnList = "employee_id")
})
public class TaskAssignment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    /**
     * Unified workforce identity: {@link com.arudra.crm.entity.ResourceType} + master id
     * (users.id for EMPLOYEE, contractors.id for CONTRACTOR). This is the source of truth for
     * who the task is assigned to, replacing the employee-only model.
     */
    @Column(name = "resource_type", length = 30)
    private String resourceType = ResourceType.EMPLOYEE;

    @Column(name = "resource_id")
    private Long resourceId;

    /**
     * Denormalized convenience, populated ONLY for EMPLOYEE rows so the mobile employee module and
     * its {@code findByTaskIdAndEmployeeId} queries keep working unchanged. Null for contractors.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private User employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_id")
    private User assignedBy;

    @Column(name = "assigned_date")
    private LocalDateTime assignedDate = LocalDateTime.now();

    @Column(name = "expected_completion")
    private LocalDateTime expectedCompletion;

    @Column(nullable = false, length = 50)
    // ASSIGNED, ACCEPTED, IN_PROGRESS, PAUSED, WAITING_MATERIAL, WAITING_APPROVAL,
    // COMPLETED, REJECTED, REWORK, CANCELLED
    private String status = "ASSIGNED";

    @Column(length = 50)
    private String role; // e.g. LEAD, HELPER — per-employee role on this task

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
