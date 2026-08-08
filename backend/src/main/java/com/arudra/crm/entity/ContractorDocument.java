package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Contractor compliance document — agreement, insurance, licence, certificate, invoice, work order. */
@Getter
@Setter
@Entity
@Table(name = "contractor_documents")
public class ContractorDocument extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    @Column(name = "file_name", nullable = false, length = 200)
    private String fileName;

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Column(name = "type", nullable = false, length = 50)
    private String type;
    // AGREEMENT, ID_PROOF, CERTIFICATE, INSURANCE, LICENSE, GST, PAN,
    // QUOTATION, INVOICE, WORK_ORDER, PHOTO

    @Column(name = "document_number", length = 100)
    private String documentNumber;

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(nullable = false)
    private Boolean verified = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    /** Computed, not persisted: has an expiry date that has already passed. */
    @Transient
    public boolean isExpired() {
        return expiryDate != null && expiryDate.isBefore(LocalDate.now());
    }
}
