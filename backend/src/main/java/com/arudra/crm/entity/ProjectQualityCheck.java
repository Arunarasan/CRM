package com.arudra.crm.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "project_quality_checks", indexes = {
    @Index(name = "idx_pqc_project", columnList = "project_id")
})
public class ProjectQualityCheck extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @NotBlank
    @Column(name = "checklist_category", length = 100)
    private String checklistCategory; // Material, Installation, Safety, Electrical, etc.

    @NotBlank
    @Column(name = "item_checked", length = 255)
    private String itemChecked;

    @NotBlank
    @Column(nullable = false, length = 50)
    private String status; // APPROVED, REJECTED, REWORK_REQUIRED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspector_id")
    private User inspector;

    @Column(name = "inspection_date")
    private LocalDate inspectionDate;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
