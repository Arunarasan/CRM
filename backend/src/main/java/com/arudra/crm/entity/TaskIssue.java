package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** An issue a field employee reports against a task (material shortage, site issue, etc). */
@Getter
@Setter
@Entity
@Table(name = "task_issues")
public class TaskIssue extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private User employee;

    @Column(name = "issue_type", nullable = false, length = 50)
    // MATERIAL_SHORTAGE, CUSTOMER_CHANGE, MEASUREMENT_ISSUE, SITE_ISSUE, DELAY, SAFETY_ISSUE
    private String issueType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 20)
    private String status = "OPEN"; // OPEN, ACKNOWLEDGED, RESOLVED

    @Column(name = "reported_at")
    private LocalDateTime reportedAt = LocalDateTime.now();

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolution_remarks", columnDefinition = "TEXT")
    private String resolutionRemarks;
}
