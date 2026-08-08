package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "quotations")
public class Quotation extends BaseEntity {

    @Column(name = "quotation_number", nullable = false, unique = true, length = 50)
    private String quotationNumber;

    @Column(name = "quotation_date")
    private LocalDate quotationDate;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "revision_number")
    private Integer revisionNumber = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "convertedToProject", "convertedToCustomer"})
    private Lead lead;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_visit_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private SiteVisit siteVisit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "quotation", "boq", "project"})
    private Measurement measurement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "quotation", "project", "measurement"})
    private Boq boq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "quotation", "boq", "measurement"})
    private Project project;

    @OneToMany(mappedBy = "quotation", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("quotation")
    private List<QuotationItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "quotation", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("quotation")
    private List<QuotationDiscount> discounts = new ArrayList<>();

    @OneToMany(mappedBy = "quotation", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("quotation")
    private List<QuotationTax> taxes = new ArrayList<>();

    @OneToMany(mappedBy = "quotation", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("quotation")
    private List<QuotationLabour> labours = new ArrayList<>();

    @OneToMany(mappedBy = "quotation", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("quotation")
    private List<QuotationAdditionalCharge> additionalCharges = new ArrayList<>();

    @OneToMany(mappedBy = "quotation", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("quotation")
    private List<QuotationTerm> terms = new ArrayList<>();

    @OneToMany(mappedBy = "quotation", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("quotation")
    private List<QuotationAttachment> attachments = new ArrayList<>();

    @Column(precision = 15, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2)
    private BigDecimal gst = BigDecimal.ZERO;

    // Header-level roll-ups for the Grand Summary, computed by recalculateTotals.
    @Column(name = "material_total", precision = 15, scale = 2)
    private BigDecimal materialTotal = BigDecimal.ZERO;

    @Column(name = "labour_total", precision = 15, scale = 2)
    private BigDecimal labourTotal = BigDecimal.ZERO;

    @Column(name = "additional_charges_total", precision = 15, scale = 2)
    private BigDecimal additionalChargesTotal = BigDecimal.ZERO;

    @Column(name = "grand_total", precision = 15, scale = 2)
    private BigDecimal grandTotal = BigDecimal.ZERO;

    @Column(nullable = false, length = 50)
    private String status = "DRAFT"; 

    @Column(length = 20)
    private String priority = "MEDIUM"; 

    @Column(length = 10)
    private String currency = "INR";

    @Column(columnDefinition = "TEXT")
    private String termsAndConditions;

    @Column(columnDefinition = "TEXT")
    private String customerSignatureBase64;

    @Column(name = "parent_quotation_id")
    private Long parentQuotationId;

    @Column(name = "is_latest_version")
    private Boolean isLatestVersion = true;

    @Column(name = "quotation_mode", length = 20)
    private String quotationMode = "FULL_HOUSE"; // FULL_HOUSE, PARTIAL, BUDGET

    @Column(name = "budget_cap", precision = 15, scale = 2)
    private BigDecimal budgetCap;

    @Column(name = "internal_approval_status", length = 50)
    private String internalApprovalStatus = "PENDING"; 

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prepared_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User preparedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User reviewedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User approvedBy;

    @Column(name = "approved_date")
    private LocalDateTime approvedDate;
}
