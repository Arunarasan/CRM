package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** A named execution phase within a Project (e.g. "Ground Floor", "Modular Kitchen"). Unlimited phases per project. */
@Getter
@Setter
@Entity
@Table(name = "project_phases", indexes = {
    @Index(name = "idx_pp_project", columnList = "project_id")
})
public class ProjectPhase extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @NotBlank
    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    private Integer sequence = 1;

    @Column(length = 50)
    private String status = "PLANNING"; // PLANNING, IN_PROGRESS, COMPLETED, ON_HOLD

    @Column(precision = 15, scale = 2)
    private BigDecimal budget;

    @Column(name = "estimated_cost", precision = 15, scale = 2)
    private BigDecimal estimatedCost;

    @Column(name = "actual_cost", precision = 15, scale = 2)
    private BigDecimal actualCost;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "completion_percentage")
    private Integer completionPercentage = 0;

    @Column(name = "completed_date")
    private LocalDate completedDate;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    /** Plain id, no FK constraint — set when this phase was generated from a BoqPhase, used to make regeneration idempotent. */
    @Column(name = "boq_phase_id")
    private Long boqPhaseId;
}
