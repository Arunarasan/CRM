package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "project_documents", indexes = {
    @Index(name = "idx_pd_project", columnList = "project_id")
})
public class ProjectDocument extends BaseEntity {

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "document_type", length = 100)
    private String documentType; // Agreement, Quotation, Invoices, PO, BOQ, CAD, Photos

    @Column(name = "file_name", nullable = false, length = 200)
    private String fileName;

    @Column(name = "file_url", length = 500)
    private String fileUrl;

    @Column(name = "file_base64", columnDefinition = "TEXT")
    private String fileBase64;

    @Column(name = "document_version")
    private Integer documentVersion = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    private User uploadedBy;

    @Column(name = "upload_date")
    private LocalDateTime uploadDate = LocalDateTime.now();

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
