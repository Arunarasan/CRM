package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * One immutable entry in a work item's Daily Progress Timeline. Doubles as the audit log:
 * every progress/status change appends a row (old vs new progress/status, who, when, remarks,
 * photos) and previous entries are never overwritten.
 */
@Getter
@Setter
@Entity
@Table(name = "project_item_progress_logs", indexes = {
    @Index(name = "idx_pipl_item", columnList = "item_id"),
    @Index(name = "idx_pipl_time", columnList = "log_time")
})
public class ProjectItemProgressLog extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private ProjectRoomItem item;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User user;

    /** ASSIGNED, STARTED, PROGRESS_UPDATED, STATUS_CHANGED, COMPLETED, REOPENED, INSPECTION, ON_HOLD, ... */
    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "old_progress")
    private Integer oldProgress;

    @Column(name = "new_progress")
    private Integer newProgress;

    @Column(name = "old_status", length = 50)
    private String oldStatus;

    @Column(name = "new_status", length = 50)
    private String newStatus;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(columnDefinition = "TEXT")
    private String photos;

    @Column(name = "log_time", nullable = false)
    private LocalDateTime logTime = LocalDateTime.now();
}
