package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "leads", indexes = {
    @Index(name = "idx_lead_status", columnList = "status"),
    @Index(name = "idx_lead_email", columnList = "email"),
    @Index(name = "idx_lead_assigned_employee", columnList = "assigned_executive_id"),
    @Index(name = "idx_lead_stage", columnList = "stage"),
    @Index(name = "idx_lead_temperature", columnList = "lead_temperature"),
    @Index(name = "idx_lead_source", columnList = "lead_source"),
    @Index(name = "idx_lead_next_follow_up", columnList = "next_follow_up_date"),
    @Index(name = "idx_lead_mobile", columnList = "mobile_number")
})
public class Lead extends BaseEntity {

    // --- Basic Information ---
    @Column(name = "lead_number", unique = true, length = 50)
    private String leadNumber;

    @NotBlank
    @Column(length = 200)
    private String name; // Lead Title / Customer Name if individual

    @Column(name = "lead_type", length = 50)
    private String leadType;

    @Column(name = "lead_source", length = 50)
    private String leadSource;

    @Column(length = 20)
    private String priority; // Low, Medium, High, Urgent

    @NotBlank
    @Column(nullable = false, length = 50)
    private String status; // New, Contacted, Follow-up, Interested, ... (see LeadWorkflow)

    @Column(length = 50)
    private String stage; // New Lead, First Contact, Requirement Discussion, Follow-up, Site Visit,
                          // Measurement, Quotation, Negotiation, Approval, Project

    @Column(name = "lead_temperature", length = 20)
    private String leadTemperature; // Hot, Warm, Cold

    // --- Customer Information ---
    @Column(name = "company_name", length = 150)
    private String companyName;

    @Column(name = "contact_person", length = 150)
    private String contactPerson;

    // No @NotBlank here: the column is nullable and existing leads may lack a mobile number.
    // Enforcing it as an entity constraint made Hibernate reject the lead at *every* flush (e.g. the
    // auto-flush during quotation-to-project conversion), rolling back unrelated operations. Required-
    // field validation for the create form belongs at the input/DTO layer, not on the persisted entity.
    @Column(name = "mobile_number", length = 50)
    private String mobileNumber;

    @Column(name = "alternate_mobile", length = 50)
    private String alternateMobile;

    @Column(name = "whatsapp_number", length = 50)
    private String whatsappNumber;

    @Email
    @Column(length = 100)
    private String email;

    @Column(name = "gst_number", length = 50)
    private String gstNumber;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String district;

    @Column(length = 100)
    private String state;

    @Column(length = 20)
    private String pincode;

    @Column(name = "google_map_location", columnDefinition = "TEXT")
    private String googleMapLocation;

    // --- Property Details ---
    @Column(name = "property_type", length = 100)
    private String propertyType;

    @Column(name = "property_name", length = 150)
    private String propertyName;

    @Column(name = "site_address", columnDefinition = "TEXT")
    private String siteAddress;

    @Column(length = 150)
    private String landmark;

    @Column(name = "floor_count")
    private Integer floorCount;

    @Column(name = "area_sqft", precision = 10, scale = 2)
    private BigDecimal areaSqft;

    @Column(name = "expected_work_area", precision = 10, scale = 2)
    private BigDecimal expectedWorkArea;

    @Column(name = "current_construction_stage", length = 100)
    private String currentConstructionStage;

    // --- Requirement Details ---
    @Column(name = "requirement_category", length = 100)
    private String requirementCategory;

    @Column(name = "project_description", columnDefinition = "TEXT")
    private String projectDescription;

    @Column(name = "customer_requirements", columnDefinition = "TEXT")
    private String customerRequirements;

    @Column(name = "preferred_design_style", length = 100)
    private String preferredDesignStyle;

    @Column(name = "preferred_material", length = 100)
    private String preferredMaterial;

    @Column(name = "preferred_color_theme", length = 100)
    private String preferredColorTheme;

    @Column(name = "preferred_completion_date")
    private LocalDate preferredCompletionDate;

    @Column(name = "estimated_duration", length = 100)
    private String estimatedDuration;

    // --- Scope of Work / Customer Requirements checklist ---
    @Column(name = "rooms_required", columnDefinition = "TEXT")
    private String roomsRequired; // free text / comma separated list of rooms

    @Column(name = "req_kitchen")
    private Boolean reqKitchen = false;

    @Column(name = "req_wardrobe")
    private Boolean reqWardrobe = false;

    @Column(name = "req_tv_unit")
    private Boolean reqTvUnit = false;

    @Column(name = "req_false_ceiling")
    private Boolean reqFalseCeiling = false;

    @Column(name = "req_painting")
    private Boolean reqPainting = false;

    @Column(name = "req_flooring")
    private Boolean reqFlooring = false;

    @Column(name = "req_electrical")
    private Boolean reqElectrical = false;

    @Column(name = "req_plumbing")
    private Boolean reqPlumbing = false;

    @Column(name = "req_wood_finish")
    private Boolean reqWoodFinish = false;

    @Column(name = "special_requests", columnDefinition = "TEXT")
    private String specialRequests;

    // --- Budget Information ---
    @Column(name = "estimated_budget", precision = 15, scale = 2)
    private BigDecimal estimatedBudget;

    @Column(name = "minimum_budget", precision = 15, scale = 2)
    private BigDecimal minimumBudget;

    @Column(name = "maximum_budget", precision = 15, scale = 2)
    private BigDecimal maximumBudget;

    @Column(name = "expected_project_value", precision = 15, scale = 2)
    private BigDecimal expectedProjectValue;

    @Column(name = "payment_preference", length = 100)
    private String paymentPreference;

    @Column(name = "expected_start_date")
    private LocalDate expectedStartDate;

    @Column(name = "expected_end_date")
    private LocalDate expectedEndDate;

    // --- Sales Information ---
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_executive_id")
    private User assignedSalesExecutive;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_id")
    private User assignedBy;

    @Column(name = "assigned_date")
    private LocalDateTime assignedDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_manager_id")
    private User projectManager;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_owner_id")
    private User leadOwner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_designer_id")
    private User assignedDesigner;

    @Column(length = 100)
    private String branch;

    @Column(length = 100)
    private String department;

    // --- Follow-up Management ---
    @Column(name = "next_follow_up_date")
    private LocalDate nextFollowUpDate;

    @Column(name = "next_follow_up_time")
    private LocalTime nextFollowUpTime;

    @Column(name = "reminder_enabled")
    private Boolean reminder = false;

    @Column(name = "reminder_type", length = 50)
    private String reminderType;

    @Column(name = "last_follow_up")
    private LocalDateTime lastFollowUp;

    @Column(name = "last_contact_at")
    private LocalDateTime lastContactAt; // updated by follow-ups AND communications

    @Column(name = "follow_up_count")
    private Integer followUpCount = 0;

    @Column(name = "follow_up_notes", columnDefinition = "TEXT")
    private String followUpNotes;

    @Column(name = "follow_up_outcome", length = 100)
    private String followUpOutcome;

    // --- Site Visit ---
    @Column(name = "site_visit_required")
    private Boolean siteVisitRequired = false;

    @Column(name = "site_visit_date")
    private LocalDate siteVisitDate;

    @Column(name = "site_visit_time")
    private LocalTime siteVisitTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_engineer_id")
    private User assignedEngineer;

    @Column(name = "visit_status", length = 50)
    private String visitStatus;

    @Column(name = "measurement_required")
    private Boolean measurementRequired = false;

    @Column(name = "measurement_completed")
    private Boolean measurementCompleted = false;

    @Column(name = "site_notes", columnDefinition = "TEXT")
    private String siteNotes;

    // --- Quotation Information ---
    @Column(name = "quotation_created")
    private Boolean quotationCreated = false;

    @Column(name = "quotation_number", length = 50)
    private String quotationNumber;

    @Column(name = "quotation_amount", precision = 15, scale = 2)
    private BigDecimal quotationAmount;

    @Column(name = "quotation_status", length = 50)
    private String quotationStatus;

    @Column(name = "approval_status", length = 50)
    private String approvalStatus;

    @Column(name = "quotation_date")
    private LocalDate quotationDate;

    // --- Conversion ---
    @Column(name = "is_converted", nullable = false)
    private Boolean isConverted = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "converted_customer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "assignedEmployee", "tags"})
    private Customer convertedToCustomer;

    // Shallow serialization: Project points back to Lead, so nested refs must be
    // cut here to avoid a cyclic (unbounded) JSON graph.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "converted_project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "lead", "customer",
            "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project convertedToProject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "converted_by_id")
    private User convertedBy;

    @Column(name = "converted_date")
    private LocalDateTime convertedDate;

    @Column(name = "conversion_notes", columnDefinition = "TEXT")
    private String conversionNotes;

    // --- Lost Lead ---
    @Column(name = "lost_reason", columnDefinition = "TEXT")
    private String lostReason;

    @Column(length = 150)
    private String competitor;

    @Column(name = "customer_feedback", columnDefinition = "TEXT")
    private String customerFeedback;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "can_reopen")
    private Boolean canReopen = true;

}
