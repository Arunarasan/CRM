package com.arudra.crm.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "project_stages", indexes = {
    @Index(name = "idx_project_stage", columnList = "project_id")
})
public class ProjectStage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @NotBlank
    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 50)
    private String status = "PENDING"; // PENDING, IN_PROGRESS, COMPLETED, DELAYED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "completion_date")
    private LocalDate completionDate;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "completion_percentage")
    private Integer completionPercentage = 0;
}
