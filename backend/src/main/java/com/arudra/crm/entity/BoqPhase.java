package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** A named execution phase within a BOQ (e.g. "Phase 1 - Ground Floor Windows"). */
@Getter
@Setter
@Entity
@Table(name = "boq_phases")
public class BoqPhase extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id", nullable = false)
    private Boq boq;

    @Column(name = "phase_name", nullable = false, length = 200)
    private String phaseName;

    @Column(nullable = false)
    private Integer sequence = 1;

    @Column(length = 20)
    private String status = "PLANNING"; // PLANNING, IN_PROGRESS, COMPLETED, ON_HOLD

    @Column(precision = 15, scale = 2)
    private BigDecimal budget;

    @Column(name = "completion_percent")
    private Integer completionPercent = 0;

    /** Plain id, no FK constraint — the quotation generated for this phase, if any. */
    @Column(name = "quotation_id")
    private Long quotationId;

    /** Soft disable — e.g. customer drops this floor; excludes it from active totals/tasks/inventory while preserving history. */
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}
