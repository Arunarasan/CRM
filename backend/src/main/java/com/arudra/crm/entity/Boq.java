package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "boqs")
public class Boq extends BaseEntity {

    @Column(name = "boq_number", unique = true, length = 50)
    private String boqNumber;

    @Column(name = "property_name", length = 200)
    private String propertyName;

    @Column(name = "quotation_mode", length = 20)
    private String quotationMode = "FULL_HOUSE"; // FULL_HOUSE, PARTIAL, BUDGET

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "lead", "boq", "quotation", "measurement"})
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "lead", "boq", "quotation", "project"})
    private Measurement measurement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "boq", "project", "measurement"})
    private Quotation quotation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "convertedToCustomer", "convertedToProject"})
    private Lead lead;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_visit_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "lead", "customer", "project"})
    private SiteVisit siteVisit;

    @Column(name = "revision_number")
    private Integer revisionNumber = 1;

    /** The BOQ this one was revised from (null for originals). Plain id, no FK constraint — mirrors Quotation.parentQuotationId. */
    @Column(name = "parent_boq_id")
    private Long parentBoqId;

    @Column(name = "is_latest_version")
    private Boolean isLatestVersion = true;

    @Column(length = 50)
    private String status = "DRAFT"; // DRAFT, REVIEW, APPROVED, REJECTED

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User createdByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User approvedBy;

    @Column(name = "approved_date")
    private LocalDateTime approvedDate;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    /** Why this revision was created (customer request, site condition, etc.) — null for the original/Master BOQ. */
    @Column(name = "revision_reason", columnDefinition = "TEXT")
    private String revisionReason;

    /** LINKED (has a Measurement) or UNLINKED_LEGACY (pre-existing standalone BOQ awaiting manual assignment). */
    @Column(name = "link_status", length = 20, nullable = false)
    private String linkStatus = "LINKED";

    @OneToMany(mappedBy = "boq", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("boq")
    private List<BoqItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "boq", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("boq")
    private List<BoqPhase> phases = new ArrayList<>();

    @Column(name = "material_total", precision = 15, scale = 2)
    private BigDecimal materialTotal = BigDecimal.ZERO;

    @Column(name = "labour_total", precision = 15, scale = 2)
    private BigDecimal labourTotal = BigDecimal.ZERO;

    /**
     * Manual overrides for the material / labour totals. When null (the default) the total is summed
     * from the line items' materials/labours as before; when set, the entered lump-sum is used instead
     * and drives subtotal → discount → tax → grand total. Lets a BOQ be priced as a lump sum without
     * itemising every material/labour line.
     */
    @Column(name = "material_total_override", precision = 15, scale = 2)
    private BigDecimal materialTotalOverride;

    @Column(name = "labour_total_override", precision = 15, scale = 2)
    private BigDecimal labourTotalOverride;

    @Column(precision = 15, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "discount_type", length = 20)
    private String discountType = "PERCENT"; // PERCENT or FLAT

    @Column(precision = 15, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO; // raw input (percent or flat amount, per discountType)

    @Column(name = "discount_amount", precision = 15, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO; // computed

    @Column(name = "tax_percent", precision = 5, scale = 2)
    private BigDecimal taxPercent = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 15, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO; // computed

    @Column(name = "grand_total", precision = 15, scale = 2)
    private BigDecimal grandTotal = BigDecimal.ZERO;
}
