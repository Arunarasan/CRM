package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A change an employee raised from the self-service portal that an admin must approve before it
 * touches the master record. Two kinds:
 * <ul>
 *   <li><b>PROFILE</b> — proposed phone / emergency contact / profile photo. On approval the
 *       non-null {@code proposed*} fields are copied onto the {@link Employee}.</li>
 *   <li><b>DOCUMENT</b> — a document to add to the employee's file. On approval an
 *       {@link EmployeeDocument} is created from {@code docName/docType/docFileUrl}.</li>
 * </ul>
 * Employee-raised and self-scoped: {@code requestedBy} is the login, {@code employee} the HR record.
 * Password change is a security action and is deliberately NOT modelled here (stays instant).
 */
@Getter
@Setter
@Entity
@Table(name = "profile_change_requests", indexes = {
        @Index(name = "idx_pcr_employee", columnList = "employee_id"),
        @Index(name = "idx_pcr_status", columnList = "status")
})
public class ProfileChangeRequest extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "workforce", "department"})
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User requestedBy;

    /** PROFILE or DOCUMENT. */
    @Column(name = "change_type", nullable = false, length = 20)
    private String changeType;

    // --- PROFILE proposal (only the fields the employee changed are set) -----
    @Column(name = "proposed_phone", length = 20)
    private String proposedPhone;

    @Column(name = "proposed_emergency_name", length = 100)
    private String proposedEmergencyName;

    @Column(name = "proposed_emergency_phone", length = 20)
    private String proposedEmergencyPhone;

    @Column(name = "proposed_photo_url", length = 500)
    private String proposedPhotoUrl;

    @Column(name = "proposed_first_name", length = 100)
    private String proposedFirstName;

    @Column(name = "proposed_last_name", length = 100)
    private String proposedLastName;

    // Encrypted at rest; masked in API responses (security.Pii).
    @Convert(converter = com.arudra.crm.security.PiiCryptoConverter.class)
    @com.fasterxml.jackson.databind.annotation.JsonSerialize(using = com.arudra.crm.security.PiiMaskSerializer.class)
    @Column(name = "proposed_bank_account", length = 512)
    private String proposedBankAccount;

    // Encrypted at rest; masked in API responses (security.Pii).
    @Convert(converter = com.arudra.crm.security.PiiCryptoConverter.class)
    @com.fasterxml.jackson.databind.annotation.JsonSerialize(using = com.arudra.crm.security.PiiMaskSerializer.class)
    @Column(name = "proposed_ifsc", length = 512)
    private String proposedIfsc;

    @Column(name = "proposed_pf_number", length = 50)
    private String proposedPfNumber;

    @Column(name = "proposed_esi_number", length = 50)
    private String proposedEsiNumber;

    @Column(name = "proposed_uan", length = 50)
    private String proposedUan;

    // --- DOCUMENT proposal ----------------------------------------------------
    @Column(name = "doc_name", length = 150)
    private String docName;

    @Column(name = "doc_type", length = 50)
    private String docType;

    @Column(name = "doc_file_url", length = 500)
    private String docFileUrl;

    /** PENDING, APPROVED, REJECTED. */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @Column(name = "review_remarks", length = 500)
    private String reviewRemarks;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    /** A masked value ("••••1234") sent back by a form keeps the stored number. */
    public void setProposedBankAccount(String proposedBankAccount) {
        this.proposedBankAccount = com.arudra.crm.security.Pii.keep(proposedBankAccount, this.proposedBankAccount);
    }

    /** A masked value ("••••1234") sent back by a form keeps the stored number. */
    public void setProposedIfsc(String proposedIfsc) {
        this.proposedIfsc = com.arudra.crm.security.Pii.keep(proposedIfsc, this.proposedIfsc);
    }
}
