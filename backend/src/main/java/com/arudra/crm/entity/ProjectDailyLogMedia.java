package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Photo/video attached to a ProjectDailyLog entry. */
@Getter
@Setter
@Entity
@Table(name = "project_daily_log_media")
public class ProjectDailyLogMedia extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_log_id", nullable = false)
    private ProjectDailyLog dailyLog;

    @Column(name = "media_type", nullable = false, length = 20)
    private String mediaType; // PHOTO, VIDEO

    @Column(name = "file_url", columnDefinition = "TEXT")
    private String fileUrl;

    @Column(length = 255)
    private String caption;
}
