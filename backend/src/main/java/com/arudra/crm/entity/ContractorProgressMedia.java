package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Photo/video evidence attached to either a daily progress report or a quality inspection.
 * Files are uploaded through the shared {@code POST /api/uploads} endpoint and referenced by URL.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_progress_media", indexes = {
    @Index(name = "idx_cpm_progress", columnList = "progress_id"),
    @Index(name = "idx_cpm_inspection", columnList = "inspection_id")
})
public class ContractorProgressMedia extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "progress_id")
    private ContractorDailyProgress progress;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_id")
    private ContractorQualityInspection inspection;

    @Column(name = "media_type", nullable = false, length = 20)
    private String mediaType = "PHOTO"; // PHOTO, VIDEO, DOCUMENT

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(length = 500)
    private String caption;
}
