package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** An employee's request to be added as a helper on a task someone else already holds. */
@Getter
@Setter
@Entity
@Table(name = "task_join_requests")
public class TaskJoinRequest extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    /** PENDING, APPROVED, REJECTED, CANCELLED. */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @Column(length = 500)
    private String note;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by_id")
    private User decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;
}
