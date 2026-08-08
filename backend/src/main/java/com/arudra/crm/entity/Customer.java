package com.arudra.crm.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "customers", indexes = {
    @Index(name = "idx_customer_name", columnList = "name"),
    @Index(name = "idx_customer_email", columnList = "email")
})
public class Customer extends BaseEntity {

    @NotBlank
    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 20)
    private String phone;

    @Email
    @Column(length = 100)
    private String email;

    @Column(name = "billing_address", columnDefinition = "TEXT")
    private String billingAddress;

    @Column(name = "site_address", columnDefinition = "TEXT")
    private String siteAddress;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String district;

    @Column(length = 100)
    private String state;

    @Column(length = 100)
    private String country;

    @Column(length = 20)
    private String pincode;

    @Column(name = "google_map_location", length = 500)
    private String googleMapLocation;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "customer_code", length = 50, unique = true)
    private String customerCode;

    @Column(name = "customer_type", length = 50)
    private String customerType; // Individual, Business, Builder, Architect, Contractor

    @Column(name = "company_name", length = 200)
    private String companyName;

    @Column(name = "contact_person_name", length = 100)
    private String contactPersonName;

    @Column(name = "alternate_phone", length = 20)
    private String alternatePhone;

    @Column(name = "whatsapp_number", length = 20)
    private String whatsappNumber;

    @Column(length = 200)
    private String website;

    @Column(name = "pan_number", length = 50)
    private String panNumber;

    @Column(name = "customer_since")
    private LocalDate customerSince;

    @Column(length = 50)
    private String status = "Active"; // Active, Inactive, Blacklisted

    @Column(name = "gst_number", length = 50)
    private String gstNumber;

    @Column(name = "credit_limit", precision = 15, scale = 2)
    private java.math.BigDecimal creditLimit;

    /** Ledger starting balance (positive = customer owes us) from before the system took over. */
    @Column(name = "opening_balance", precision = 15, scale = 2, nullable = false)
    private java.math.BigDecimal openingBalance = java.math.BigDecimal.ZERO;

    @Column(name = "payment_terms", length = 200)
    private String paymentTerms;

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Column(name = "preferred_language", length = 50)
    private String preferredLanguage;

    @Column(name = "preferred_contact_method", length = 50)
    private String preferredContactMethod; // Phone, WhatsApp, Email

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_employee_id")
    private User assignedEmployee;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "customer_tags",
            joinColumns = @JoinColumn(name = "customer_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private java.util.Set<Tag> tags = new java.util.HashSet<>();
}
