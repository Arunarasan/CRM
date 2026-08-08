package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Singleton (id = 1) manager-configurable tuning for the Smart Employee Auto Assignment engine.
 * Holds the workload caps, feature toggles and the suitability-score weights the engine applies
 * when ranking candidates. Every field maps directly to a "Manager Settings" control on the UI.
 */
@Getter
@Setter
@Entity
@Table(name = "assignment_settings")
public class AssignmentSettings extends BaseEntity {

    public static final Long SINGLETON_ID = 1L;

    @Column(name = "max_tasks_per_day", nullable = false)
    private Integer maxTasksPerDay = 5;

    @Column(name = "max_working_hours", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxWorkingHours = new BigDecimal("8.00");

    @Column(name = "max_overtime_hours", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxOvertimeHours = new BigDecimal("3.00");

    @Column(name = "auto_balance_enabled", nullable = false)
    private Boolean autoBalanceEnabled = true;

    @Column(name = "allow_overtime", nullable = false)
    private Boolean allowOvertime = false;

    @Column(name = "allow_low_priority_reassign", nullable = false)
    private Boolean allowLowPriorityReassign = false;

    @Column(name = "min_suitability_score", nullable = false)
    private Integer minSuitabilityScore = 40;

    @Column(name = "mandatory_skill_matching", nullable = false)
    private Boolean mandatorySkillMatching = true;

    @Column(name = "prefer_same_project_team", nullable = false)
    private Boolean preferSameProjectTeam = true;

    @Column(name = "prefer_nearest", nullable = false)
    private Boolean preferNearest = false;

    @Column(name = "min_performance_score", nullable = false)
    private Integer minPerformanceScore = 0;

    // --- Suitability weights (percent) ---------------------------------------
    @Column(name = "weight_availability", nullable = false)
    private Integer weightAvailability = 30;

    @Column(name = "weight_workload", nullable = false)
    private Integer weightWorkload = 25;

    @Column(name = "weight_skills", nullable = false)
    private Integer weightSkills = 20;

    @Column(name = "weight_department", nullable = false)
    private Integer weightDepartment = 10;

    @Column(name = "weight_performance", nullable = false)
    private Integer weightPerformance = 5;

    @Column(name = "weight_location", nullable = false)
    private Integer weightLocation = 5;

    @Column(name = "weight_experience", nullable = false)
    private Integer weightExperience = 5;
}
