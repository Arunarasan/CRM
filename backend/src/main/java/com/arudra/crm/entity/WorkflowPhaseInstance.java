package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * The runtime state of one {@link WorkflowPhase} inside a {@link WorkflowInstance}. Tasks are
 * materialized only when a phase becomes ACTIVE (progressive generation), and the phase completes
 * when all its generated tasks are done — which activates the next phase.
 */
@Getter
@Setter
@Entity
@Table(name = "workflow_phase_instances")
public class WorkflowPhaseInstance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_instance_id", nullable = false)
    private WorkflowInstance workflowInstance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id", nullable = false)
    private WorkflowPhase phase;

    /** PENDING | ACTIVE | COMPLETED | SKIPPED */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @Column(nullable = false)
    private Integer progress = 0;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
