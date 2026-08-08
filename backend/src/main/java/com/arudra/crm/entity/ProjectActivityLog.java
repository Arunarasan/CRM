package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "project_activity_logs", indexes = {
    @Index(name = "idx_pal_project", columnList = "project_id")
})
public class ProjectActivityLog extends BaseEntity {

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(length = 50)
    private String role; // System, Admin, Manager, etc.

    @Column(name = "log_time", nullable = false)
    private LocalDateTime time = LocalDateTime.now();

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;
}
