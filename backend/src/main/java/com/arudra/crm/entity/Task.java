package com.arudra.crm.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "tasks", indexes = {
    @Index(name = "idx_task_status", columnList = "status"),
    @Index(name = "idx_task_project", columnList = "project_id"),
    @Index(name = "idx_task_assigned_employee", columnList = "assigned_employee_id")
})
public class Task extends BaseEntity {

    @NotBlank
    @Column(name = "task_name", nullable = false, length = 255)
    private String taskName;

    /**
     * Nullable since V33: lead-stage workflow tasks exist before any project. Execution/manual tasks
     * still carry a project — see {@code source} / the workflow links below.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_employee_id")
    private User assignedEmployee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id")
    private Contractor contractor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id")
    private ProjectPhase phase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private ProjectRoom room;

    /** Plain id, no FK constraint — set when this task was generated from a BoqItem, used to make regeneration idempotent. */
    @Column(name = "generated_from_boq_item_id")
    private Long generatedFromBoqItemId;

    @NotBlank
    @Column(nullable = false, length = 20)
    private String priority; // LOW, MEDIUM, HIGH

    @NotBlank
    @Column(nullable = false, length = 50)
    private String status; // PENDING, IN_PROGRESS, COMPLETED

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_task_id")
    private Task parentTask;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "task_dependencies",
        joinColumns = @JoinColumn(name = "task_id"),
        inverseJoinColumns = @JoinColumn(name = "dependency_id")
    )
    private java.util.Set<Task> dependencies = new java.util.HashSet<>();

    @Column(name = "is_recurring")
    private Boolean isRecurring = false;

    @Column(name = "recurring_pattern", length = 50)
    private String recurringPattern; // DAILY, WEEKLY, MONTHLY

    @Column(name = "is_template")
    private Boolean isTemplate = false;

    @Column(name = "estimated_hours")
    private Double estimatedHours;

    @Column(name = "actual_hours")
    private Double actualHours;

    @Column(name = "required_skills", length = 255)
    private String requiredSkills;

    @Column(name = "order_index")
    private Integer orderIndex = 0;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "completed_date")
    private LocalDate completedDate;

    // ---------------------------------------------------------------- workflow engine (V33)

    /** WORKFLOW (engine-generated) or MANUAL (ad-hoc / desktop / legacy). */
    @Column(name = "source", nullable = false, length = 20)
    private String source = "MANUAL";

    /** OWNER_APPROVAL | ALL_PARTICIPANTS | ANY_PARTICIPANT — how a collaborative task closes. */
    @Column(name = "completion_rule", length = 30)
    private String completionRule;

    /** SINGLE_EMPLOYEE | MULTIPLE_EMPLOYEES | TEAM */
    @Column(name = "assignment_type", length = 20)
    private String assignmentType;

    /** Comma-separated role/capability tokens allowed to pick this task (copied from the template). */
    @Column(name = "eligible_roles", length = 255)
    private String eligibleRoles;

    @Column(name = "eligible_skills", length = 255)
    private String eligibleSkills;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_template_id")
    private TaskTemplate taskTemplate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_instance_id")
    private WorkflowInstance workflowInstance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_phase_instance_id")
    private WorkflowPhaseInstance workflowPhaseInstance;

    // Plain subject ids (no FK), following the generatedFromBoqItemId convention.
    @Column(name = "lead_id")
    private Long leadId;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "site_visit_id")
    private Long siteVisitId;

    @Column(name = "measurement_id")
    private Long measurementId;

    @Column(name = "boq_id")
    private Long boqId;

    @Column(name = "quotation_id")
    private Long quotationId;
}
