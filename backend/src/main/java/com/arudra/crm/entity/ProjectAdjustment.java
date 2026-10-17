package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** One agreed price reduction on a project (e.g. customer bargaining at completion). */
@Getter
@Setter
@Entity
@Table(name = "project_adjustments")
public class ProjectAdjustment extends BaseEntity {

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    /** BARGAINING, COMPENSATION, ROUND_OFF, OTHER */
    @Column(name = "reason_code", nullable = false, length = 30)
    private String reasonCode;

    @Column(length = 1000)
    private String reason;

    @Column(name = "pending_before", precision = 15, scale = 2)
    private BigDecimal pendingBefore;

    @Column(name = "created_by_id")
    private Long createdById;
}
