package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "quotation_attachments")
public class QuotationAttachment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id", nullable = false)
    private Quotation quotation;

    @Column(nullable = false, length = 200)
    private String fileName;

    @Column(nullable = false, length = 500)
    private String fileUrl;
    
    @Column(name = "document_type", length = 50)
    private String documentType; // PDF, CAD, IMAGE, SUPPLIER_QUOTE, CONTRACT, OTHER
    
    @Column(name = "document_version")
    private Integer documentVersion = 1;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    private User uploadedBy;
}
