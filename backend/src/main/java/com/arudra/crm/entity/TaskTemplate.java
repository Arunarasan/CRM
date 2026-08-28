package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * The blueprint for a task that a {@link WorkflowPhase} generates. Carries eligibility, due-date
 * rules, assignment/completion policy and (via {@code dependencies}) which sibling templates must
 * complete first — the intra-phase LOCKED→AVAILABLE chain. A materialized {@link Task} points back
 * here through {@code Task.taskTemplate}.
 */
@Getter
@Setter
@Entity
@Table(name = "task_templates")
public class TaskTemplate extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id", nullable = false)
    private WorkflowPhase phase;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 100, unique = true)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;

    /** SINGLE_EMPLOYEE | MULTIPLE_EMPLOYEES | TEAM */
    @Column(name = "assignment_type", nullable = false, length = 20)
    private String assignmentType = "SINGLE_EMPLOYEE";

    /** OWNER_APPROVAL | ALL_PARTICIPANTS | ANY_PARTICIPANT */
    @Column(name = "completion_rule", nullable = false, length = 30)
    private String completionRule = "OWNER_APPROVAL";

    /** Comma-separated role/capability tokens an employee needs to be eligible to pick this task. */
    @Column(name = "eligible_roles", length = 255)
    private String eligibleRoles;

    @Column(name = "eligible_skills", length = 255)
    private String eligibleSkills;

    @Column(nullable = false, length = 20)
    private String priority = "MEDIUM";

    @Column(name = "estimated_hours")
    private Double estimatedHours;

    /** Days added to the {@code dueBasis} moment to compute the generated task's due date. */
    @Column(name = "due_offset_days")
    private Integer dueOffsetDays;

    /** CREATION | PREV_COMPLETION | PHASE_START */
    @Column(name = "due_basis", length = 30)
    private String dueBasis = "CREATION";

    /** Sibling templates that must be COMPLETED before a task from this template becomes AVAILABLE. */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "task_template_dependencies",
        joinColumns = @JoinColumn(name = "task_template_id"),
        inverseJoinColumns = @JoinColumn(name = "depends_on_template_id")
    )
    private java.util.Set<TaskTemplate> dependencies = new java.util.HashSet<>();
}
