package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Photo/video/voice note attached to a TaskProgressUpdate. */
@Getter
@Setter
@Entity
@Table(name = "task_progress_media")
public class TaskProgressMedia extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "progress_update_id", nullable = false)
    private TaskProgressUpdate progressUpdate;

    @Column(name = "media_type", nullable = false, length = 20)
    private String mediaType; // PHOTO, VIDEO, VOICE

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Column(length = 255)
    private String caption;

    private Double latitude;

    private Double longitude;
}
