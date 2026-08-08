package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Unified workforce document — Aadhaar, PAN, Photo, Certificate, Agreement, or Other. Files are
 * uploaded via the generic {@code /api/uploads} endpoint and stored here by URL.
 */
@Getter
@Setter
@Entity
@Table(name = "workforce_documents", indexes = {
    @Index(name = "idx_wfdoc_workforce", columnList = "workforce_id")
})
public class WorkforceDocument extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workforce_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Workforce workforce;

    /** AADHAAR, PAN, PHOTO, CERTIFICATE, AGREEMENT, OTHER. */
    @Column(name = "doc_type", nullable = false, length = 50)
    private String docType;

    @Column(name = "file_name", nullable = false, length = 200)
    private String fileName;

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
