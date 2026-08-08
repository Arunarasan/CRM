package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "lead_documents")
public class LeadDocument extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id", nullable = false)
    private Lead lead;

    @Column(nullable = false, length = 200)
    private String fileName;

    @Column(length = 500)
    private String fileUrl;

    @Column(length = 100)
    private String documentType; // PDF, Image, Video, CAD

    @Column(length = 100)
    private String category; // Property Images, Reference Images, Floor Plans, Customer Documents,
                             // Site Photos, Videos, Agreements, Other

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "document_version", length = 50)
    private String documentVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    private User uploadedBy;
}
