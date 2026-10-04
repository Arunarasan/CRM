package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** One line of a category's installation checklist. */
@Getter
@Setter
@Entity
@Table(name = "project_install_steps")
public class ProjectInstallStep extends BaseEntity {

    @Column(name = "install_category_id", nullable = false)
    private Long installCategoryId;

    @Column(nullable = false, length = 255)
    private String content;

    @Column(nullable = false)
    private Boolean done = false;

    @Column(name = "done_by_name", length = 150)
    private String doneByName;

    @Column(name = "done_at")
    private LocalDateTime doneAt;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;
}
