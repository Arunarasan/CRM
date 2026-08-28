package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A live run of a {@link WorkflowTemplate} for one business subject (a lead now; a project later).
 * Its {@link WorkflowPhaseInstance}s track which phase is active; generated {@link Task}s link back
 * via {@code Task.workflowInstance}. Exactly one active instance per subject keeps generation
 * idempotent.
 */
@Getter
@Setter
@Entity
@Table(name = "workflow_instances")
public class WorkflowInstance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private WorkflowTemplate template;

    /** LEAD | PROJECT */
    @Column(nullable = false, length = 20)
    private String scope;

    /** Plain subject ids (no FK) — set the one that matches {@code scope}. */
    @Column(name = "lead_id")
    private Long leadId;

    @Column(name = "project_id")
    private Long projectId;

    /** ACTIVE | COMPLETED | CANCELLED */
    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
