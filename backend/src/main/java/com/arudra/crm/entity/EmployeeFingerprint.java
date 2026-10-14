package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * One enrolled fingerprint sample (a SourceAFIS template) of an employee. Two scans per finger are
 * stored so matching tolerates pressure and placement. Biometric data: never serialised to clients,
 * hard-deleted (not soft-deleted) on re-enrol / remove, and only created with the employee's consent.
 */
@Getter
@Setter
@Entity
@Table(name = "employee_fingerprints")
public class EmployeeFingerprint extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    /** ISO/IEC 19794-2 finger position (1 right thumb, 2 right index, ... 6 left thumb, 7 left index, ...). */
    @Column(nullable = false)
    private Integer finger;

    @Column(name = "sample_no", nullable = false)
    private Integer sampleNo;

    @JsonIgnore
    @Lob
    @Column(nullable = false, columnDefinition = "LONGBLOB")
    private byte[] template;

    /** SourceAFIS version that produced the template (templates are tied to it). */
    @Column(name = "engine_version", nullable = false, length = 20)
    private String engineVersion;

    @Column(name = "consent_at")
    private LocalDateTime consentAt;

    @Column(name = "enrolled_by", length = 255)
    private String enrolledBy;
}
