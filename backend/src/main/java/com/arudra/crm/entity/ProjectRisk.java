package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "project_risks", indexes = {
    @Index(name = "idx_pr_project", columnList = "project_id")
})
public class ProjectRisk extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "risk_level", nullable = false, length = 50)
    private String riskLevel = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL

    @Column(nullable = false, length = 50)
    private String impact = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL

    @Column(nullable = false, length = 50)
    private String probability = "MEDIUM"; // LOW, MEDIUM, HIGH

    @Column(name = "mitigation_plan", columnDefinition = "TEXT")
    private String mitigationPlan;

    @Column(nullable = false, length = 50)
    private String status = "OPEN"; // OPEN, MITIGATED, CLOSED
}
