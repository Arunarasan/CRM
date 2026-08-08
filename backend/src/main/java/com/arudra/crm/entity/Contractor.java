package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Subcontractor master. A contractor never receives a whole project — work reaches them
 * through a {@link ContractorWorkPackage} scoped to a Project/Phase/Room/BOQ items.
 */
@Getter
@Setter
@Entity
@Table(name = "contractors", indexes = {
    @Index(name = "idx_contractor_trade", columnList = "trade"),
    @Index(name = "idx_contractor_status", columnList = "status")
})
public class Contractor extends BaseEntity {

    @Column(name = "contractor_code", unique = true, length = 50)
    private String contractorCode;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 255)
    private String email;

    @Column(length = 50)
    private String phone;

    @Column(name = "alternate_phone", length = 50)
    private String alternatePhone;

    @Column(name = "company_name", length = 255)
    private String companyName;

    @Column(name = "owner_name", length = 255)
    private String ownerName;

    @Column(name = "contact_person", length = 255)
    private String contactPerson;

    @Column(columnDefinition = "TEXT")
    private String skills; // Comma separated list of skills (legacy free-text)

    // --- Trade classification -------------------------------------------------
    /**
     * Primary trade: CARPENTRY, ALUMINIUM, GLASS, PAINTING, ELECTRICAL, PLUMBING,
     * FALSE_CEILING, FABRICATION, CIVIL, TILES, FURNITURE, HVAC, CLEANING.
     */
    @Column(length = 50)
    private String trade;

    /** Comma separated additional trades this contractor can execute. */
    @Column(columnDefinition = "TEXT")
    private String trades;

    /**
     * CARPENTER, ELECTRICIAN, PLUMBER, PAINTER, FABRICATOR, GLASS_INSTALLER, TILE_LAYER,
     * CIVIL_CONTRACTOR, INTERIOR_CONTRACTOR, MODULAR_KITCHEN_VENDOR, HVAC_CONTRACTOR, CLEANING_CONTRACTOR.
     */
    @Column(name = "contractor_type", length = 50)
    private String contractorType;

    // --- Statutory ------------------------------------------------------------
    @Column(length = 20)
    private String gstin;

    @Column(length = 20)
    private String pan;

    @Column(name = "pf_number", length = 50)
    private String pfNumber;

    @Column(name = "esi_number", length = 50)
    private String esiNumber;

    // --- Banking --------------------------------------------------------------
    @Column(name = "bank_name", length = 150)
    private String bankName;

    @Column(name = "bank_account_name", length = 200)
    private String bankAccountName;

    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber;

    @Column(name = "bank_ifsc", length = 20)
    private String bankIfsc;

    @Column(name = "bank_branch", length = 150)
    private String bankBranch;

    @Column(name = "upi_id", length = 100)
    private String upiId;

    // --- Address --------------------------------------------------------------
    @Column(name = "address_line1", length = 255)
    private String addressLine1;

    @Column(name = "address_line2", length = 255)
    private String addressLine2;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String state;

    @Column(length = 20)
    private String pincode;

    // --- Commercial -----------------------------------------------------------
    @Column(name = "hourly_rate", precision = 10, scale = 2)
    private BigDecimal hourlyRate;

    @Column(name = "daily_rate", precision = 10, scale = 2)
    private BigDecimal dailyRate;

    @Column(name = "credit_days")
    private Integer creditDays;

    @Column(name = "opening_balance", nullable = false, precision = 15, scale = 2)
    private BigDecimal openingBalance = BigDecimal.ZERO;

    /** Default retention held back on each bill, overridable per work package. */
    @Column(name = "retention_percentage", precision = 5, scale = 2)
    private BigDecimal retentionPercentage;

    @Column(name = "tds_percentage", precision = 5, scale = 2)
    private BigDecimal tdsPercentage;

    // --- Rating & status ------------------------------------------------------
    @Column(name = "performance_rating")
    private Integer performanceRating = 3; // 1-5 scale (legacy)

    @Column(name = "rating_quality", precision = 4, scale = 2)
    private BigDecimal ratingQuality;

    @Column(name = "rating_timeliness", precision = 4, scale = 2)
    private BigDecimal ratingTimeliness;

    @Column(name = "rating_safety", precision = 4, scale = 2)
    private BigDecimal ratingSafety;

    @Column(name = "overall_rating", precision = 4, scale = 2)
    private BigDecimal overallRating;

    @Column(name = "total_work_packages", nullable = false)
    private Integer totalWorkPackages = 0;

    @Column(name = "completed_work_packages", nullable = false)
    private Integer completedWorkPackages = 0;

    @Column(nullable = false, length = 30)
    private String status = "ACTIVE"; // ACTIVE, INACTIVE, BLACKLISTED, PENDING_APPROVAL

    // --- Compliance -----------------------------------------------------------
    @Column(name = "agreement_number", length = 100)
    private String agreementNumber;

    @Column(name = "payment_terms", length = 255)
    private String paymentTerms;

    @Column(name = "tds_applicable")
    private Boolean tdsApplicable;

    @Column(name = "agreement_start_date")
    private LocalDate agreementStartDate;

    @Column(name = "agreement_end_date")
    private LocalDate agreementEndDate;

    @Column(name = "insurance_number", length = 100)
    private String insuranceNumber;

    @Column(name = "insurance_expiry_date")
    private LocalDate insuranceExpiryDate;

    @Column(name = "license_number", length = 100)
    private String licenseNumber;

    @Column(name = "license_expiry_date")
    private LocalDate licenseExpiryDate;

    /** Portal login. Set when the contractor is given a User account with ROLE_CONTRACTOR. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User user;

    @Column(columnDefinition = "TEXT")
    private String notes;

    /**
     * Unified workforce header this contractor extends. Holds the shared fields (identity, address,
     * emergency contact, skills). One-to-one; the header owns the common data, this row the
     * contractor-specific data (company, GST, banking, rates, compliance).
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workforce_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Workforce workforce;
}
