package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** A category's installation checklist on a project; its % is max(ticked share, manual %). */
@Getter
@Setter
@Entity
@Table(name = "project_install_categories")
public class ProjectInstallCategory extends BaseEntity {

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false, length = 150)
    private String category;

    @Column(name = "manual_percent")
    private Integer manualPercent;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(nullable = false)
    private Boolean active = true;
}
