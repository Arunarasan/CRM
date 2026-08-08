package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Unified workforce header. Holds the ~90% of information common to every kind of workforce
 * (employees, contractors, and future freelancers/consultants/vendors). The type-specific fields
 * live in the extension tables — {@link Employee} and {@link Contractor} — each of which points back
 * here via its {@code workforce} reference.
 *
 * <p>{@code workforceType} is a plain String (matching the codebase convention that every type/status
 * field is a String, never a DB enum) so a new workforce type needs no schema change.
 */
@Getter
@Setter
@Entity
@Table(name = "workforce", indexes = {
    @Index(name = "idx_workforce_type", columnList = "workforce_type"),
    @Index(name = "idx_workforce_status", columnList = "status"),
    @Index(name = "idx_workforce_skill", columnList = "primary_skill")
})
public class Workforce extends BaseEntity {

    /** EMPLOYEE, CONTRACTOR, FREELANCER, CONSULTANT, VENDOR, TEMPORARY (extensible). */
    @Column(name = "workforce_type", nullable = false, length = 30)
    private String workforceType;

    // --- Basic information ----------------------------------------------------
    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    @Column(name = "profile_photo_url", length = 500)
    private String profilePhotoUrl;

    @Column(length = 20)
    private String mobile;

    @Column(length = 150)
    private String email;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(length = 20)
    private String gender;

    @Column(name = "address_line1", length = 255)
    private String addressLine1;

    @Column(name = "address_line2", length = 255)
    private String addressLine2;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String state;

    @Column(length = 100)
    private String country;

    @Column(length = 20)
    private String pincode;

    // --- Identity -------------------------------------------------------------
    @Column(name = "aadhaar_number", length = 20)
    private String aadhaarNumber;

    @Column(name = "pan_number", length = 20)
    private String panNumber;

    @Column(name = "driving_license", length = 50)
    private String drivingLicense;

    @Column(name = "passport_number", length = 50)
    private String passportNumber;

    // --- Emergency contact ----------------------------------------------------
    @Column(name = "emergency_contact_name", length = 100)
    private String emergencyContactName;

    @Column(name = "emergency_relationship", length = 50)
    private String emergencyRelationship;

    @Column(name = "emergency_phone", length = 20)
    private String emergencyPhone;

    // --- Skills ---------------------------------------------------------------
    @Column(name = "primary_skill", length = 100)
    private String primarySkill;

    /** Comma-separated secondary skills. */
    @Column(name = "secondary_skills", columnDefinition = "TEXT")
    private String secondarySkills;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(columnDefinition = "TEXT")
    private String certifications;

    // --- Project info ---------------------------------------------------------
    @Column(name = "available_from")
    private LocalDate availableFrom;

    /** AVAILABLE, BUSY, ON_LEAVE, INACTIVE. */
    @Column(nullable = false, length = 30)
    private String status = "AVAILABLE";

    @Column(columnDefinition = "TEXT")
    private String notes;
}
