package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** A photo/video attached to a {@link DailyReport}. */
@Getter
@Setter
@Entity
@Table(name = "daily_report_media")
public class DailyReportMedia extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    @JsonIgnore // back-reference: cut to avoid a serialization cycle
    private DailyReport report;

    @Column(name = "media_type", nullable = false, length = 20)
    private String mediaType; // PHOTO, VIDEO

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Column(length = 255)
    private String caption;
}
