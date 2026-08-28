package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** An ordered stage within a {@link WorkflowTemplate} (e.g. "Site Visit", "Quotation"). */
@Getter
@Setter
@Entity
@Table(name = "workflow_phases")
public class WorkflowPhase extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private WorkflowTemplate template;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 80)
    private String code;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;

    /** Optional phases can be skipped for project types that don't need them. */
    @Column(nullable = false)
    private Boolean required = true;
}
