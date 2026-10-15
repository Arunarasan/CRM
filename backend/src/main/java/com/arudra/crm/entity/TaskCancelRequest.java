package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** An employee's request to cancel the work behind a task; an admin approves or rejects it. */
@Getter
@Setter
@Entity
@Table(name = "task_cancel_requests")
public class TaskCancelRequest extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    /** LEAD (mark lost), PROJECT (cancel project) or TASK (cancel just the task). */
    @Column(name = "target_type", nullable = false, length = 10)
    private String targetType;

    @Column(name = "lead_id")
    private Long leadId;

    @Column(name = "project_id")
    private Long projectId;

    /** CUSTOMER_CANCELLED or OTHER_ISSUE. */
    @Column(name = "reason_code", nullable = false, length = 30)
    private String reasonCode;

    @Column(nullable = false, length = 1000)
    private String reason;

    /** PENDING, APPROVED, REJECTED. */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by_id")
    private User decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "decision_note", length = 500)
    private String decisionNote;
}
