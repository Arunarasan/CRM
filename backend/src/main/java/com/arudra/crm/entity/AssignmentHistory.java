package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Immutable audit row for every assignment event produced by the Smart Auto Assignment module:
 * a manual assign, an AI auto-assign, or a one-click replacement. Denormalises task / project /
 * employee names so the history reads correctly even after those records change or are removed.
 */
@Getter
@Setter
@Entity
@Table(name = "assignment_history", indexes = {
    @Index(name = "idx_asnhist_task", columnList = "task_id"),
    @Index(name = "idx_asnhist_resource", columnList = "resource_type, resource_id"),
    @Index(name = "idx_asnhist_status", columnList = "status"),
    @Index(name = "idx_asnhist_method", columnList = "assignment_method")
})
public class AssignmentHistory extends BaseEntity {

    public static final String METHOD_MANUAL = "MANUAL";
    public static final String METHOD_AUTO = "AUTO";
    public static final String METHOD_REPLACEMENT = "REPLACEMENT";

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_REPLACED = "REPLACED";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final String STATUS_COMPLETED = "COMPLETED";

    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "task_name", length = 255)
    private String taskName;

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "project_name", length = 255)
    private String projectName;

    @Column(name = "resource_type", nullable = false, length = 30)
    private String resourceType = ResourceType.EMPLOYEE;

    /** Assignable id: users.id for EMPLOYEE, contractors.id for CONTRACTOR. */
    @Column(name = "resource_id")
    private Long resourceId;

    /** Master HR employee id (employees.id) when the resource is an employee — for HR deep-links. */
    @Column(name = "employee_id")
    private Long employeeId;

    @Column(name = "employee_name", length = 255)
    private String employeeName;

    @Column(name = "assigned_by_id")
    private Long assignedById;

    @Column(name = "assigned_by_name", length = 255)
    private String assignedByName;

    @Column(name = "assignment_method", nullable = false, length = 20)
    private String assignmentMethod = METHOD_MANUAL;

    @Column(name = "suitability_score", precision = 5, scale = 2)
    private BigDecimal suitabilityScore;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "reassignment_reason", length = 255)
    private String reassignmentReason;

    /** When this row is a replacement, the id of the history row it superseded. */
    @Column(name = "replaced_history_id")
    private Long replacedHistoryId;

    @Column(nullable = false, length = 30)
    private String status = STATUS_ACTIVE;
}
