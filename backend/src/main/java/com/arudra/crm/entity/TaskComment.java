package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "task_comments")
public class TaskComment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(length = 50)
    private String role; // Role of the author at the time of commenting

    @Column(name = "audio_url", length = 500)
    private String audioUrl; // uploaded voice-note clip when the remark is (also) recorded

    @Column(name = "image_url", length = 500)
    private String imageUrl; // photo posted to the team chat

    @Column(name = "work_line_id")
    private Long workLineId; // project work line (product) the message is about, if tagged

    @Column(name = "tag_label", length = 255)
    private String tagLabel; // human label of that tag — product or installation category

    @Column(name = "has_attachments")
    private Boolean hasAttachments = false;

    @Column(name = "read_status")
    private Boolean readStatus = false;
}
