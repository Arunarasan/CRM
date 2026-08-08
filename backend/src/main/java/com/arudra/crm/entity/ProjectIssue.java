package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "project_issues", indexes = {
    @Index(name = "idx_pi_project", columnList = "project_id")
})
public class ProjectIssue extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "issue_title", nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 50)
    private String priority = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_id")
    private User assignedTo;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(columnDefinition = "TEXT")
    private String resolution;

    @Column(nullable = false, length = 50)
    private String status = "OPEN"; // OPEN, IN_PROGRESS, RESOLVED, CLOSED
}
