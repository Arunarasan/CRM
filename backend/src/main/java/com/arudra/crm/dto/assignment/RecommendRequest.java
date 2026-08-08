package com.arudra.crm.dto.assignment;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Input for the Smart Auto Assignment recommendation engine. Mirrors the PM's "Auto Assign
 * Employees" form: pick a task, state how long it should take, and constrain by department /
 * role / skills / headcount.
 */
@Getter
@Setter
public class RecommendRequest {

    /** The task being staffed (optional — used for de-duping already-assigned people and history). */
    private Long taskId;

    /** The project the work belongs to (optional — enables same-team / location scoring). */
    private Long projectId;

    /** Estimated effort of the task in hours. Drives capacity validation. */
    private Double estimatedHours;

    /** Required department (employees.department_id). Optional. */
    private Long departmentId;

    /** Required designation/role, matched against employee.designation. Optional. */
    private String requiredRole;

    /** Mandatory skills — a candidate must hold ALL of these when skill matching is enforced. */
    private List<String> requiredSkills;

    /** How many people the task needs. Defaults to 1. */
    private Integer requiredCount = 1;

    /** Per-request override for overtime; when null the global setting applies. */
    private Boolean allowOvertime;

    /** Include ineligible candidates (with exclusion reasons) in the response. Default true. */
    private Boolean includeExcluded = true;
}
