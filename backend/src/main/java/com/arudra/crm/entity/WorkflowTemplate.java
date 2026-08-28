package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * A configurable, DB-driven workflow definition (e.g. the default Lead lifecycle). Phases and task
 * templates hang off it. Instantiated into a {@link WorkflowInstance} when a business subject
 * (a lead, later a project) enters the workflow. Never hard-code workflow logic in code/UI — it
 * lives here.
 */
@Getter
@Setter
@Entity
@Table(name = "workflow_templates")
public class WorkflowTemplate extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 80, unique = true)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** LEAD or PROJECT — the kind of subject this workflow drives. */
    @Column(nullable = false, length = 20)
    private String scope;

    @Column(name = "lead_type", length = 80)
    private String leadType;

    @Column(name = "project_type", length = 80)
    private String projectType;

    @Column(nullable = false)
    private Boolean active = true;
}
