package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "project_team", indexes = {
    @Index(name = "idx_pt_project", columnList = "project_id"),
    @Index(name = "idx_pt_employee", columnList = "employee_id")
})
public class ProjectTeam extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private User employee;

    @Column(nullable = false, length = 50)
    private String role; // Project Manager, Site Engineer, etc.

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_id")
    private User assignedBy;

    @Column(name = "assigned_date")
    private LocalDateTime assignedDate = LocalDateTime.now();

    @Column(nullable = false, length = 50)
    private String status = "ACTIVE"; // ACTIVE, REMOVED

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
