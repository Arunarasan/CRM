package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** History of a work step or installation change — who did what, when, with an optional photo. */
@Getter
@Setter
@Entity
@Table(name = "project_work_events")
public class ProjectWorkEvent extends BaseEntity {

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "work_line_id")
    private Long workLineId;

    @Column(name = "step_id")
    private Long stepId;

    @Column(name = "install_category_id")
    private Long installCategoryId;

    @Column(name = "step_type", length = 20)
    private String stepType;

    @Column(nullable = false, length = 40)
    private String action;

    private Integer percent;

    @Column(length = 500)
    private String note;

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_name", length = 150)
    private String actorName;
}
