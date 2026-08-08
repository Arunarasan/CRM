package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "site_visit_media")
public class SiteVisitMedia extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_visit_id", nullable = false)
    private SiteVisit siteVisit;

    @Column(name = "media_type", nullable = false, length = 50)
    private String mediaType; // Image, Video, Voice, PDF, CAD

    @Column(length = 50)
    private String category; // Before Photo, During Visit Photo, After Photo, Video, Voice Note, Document, Floor Plan, Measurement Drawing

    @Column(name = "file_url", columnDefinition = "LONGTEXT")
    private String fileUrl; // URL or Base64

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "upload_time")
    private LocalDateTime uploadTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_user_id")
    private User uploadedBy;

    @Column(name = "file_version", length = 50)
    private String fileVersion;
}
