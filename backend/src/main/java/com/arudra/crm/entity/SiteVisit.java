package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "site_visits")
public class SiteVisit extends BaseEntity {

    @Column(name = "visit_number", unique = true, length = 50)
    private String visitNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "convertedToProject", "convertedToCustomer"})
    private Lead lead;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "siteVisit", "measurement"})
    private Project project;

    @Column(name = "visit_type", length = 100)
    private String visitType; // Initial Visit, Measurement, Design Discussion, etc.

    @Column(length = 50)
    private String status; // Scheduled, Confirmed, In Progress, Completed, Cancelled, Rescheduled

    @Column(length = 50)
    private String priority; // Low, Medium, High, Urgent

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(name = "scheduled_time")
    private LocalDateTime scheduledTime;

    @Column(name = "expected_duration", length = 50)
    private String expectedDuration;

    @Column(name = "actual_start_time")
    private LocalDateTime actualStartTime;

    @Column(name = "actual_end_time")
    private LocalDateTime actualEndTime;

    @Column(name = "location_address", columnDefinition = "TEXT")
    private String locationAddress;

    @Column(name = "map_location", columnDefinition = "TEXT")
    private String mapLocation;

    @Column(name = "google_maps_link", length = 500)
    private String googleMapsLink;

    @Column
    private Double latitude;

    @Column
    private Double longitude;

    @Column(name = "customer_contact_person", length = 255)
    private String customerContactPerson;

    @Column(name = "customer_mobile", length = 20)
    private String customerMobile;

    @Column(name = "visit_notes", columnDefinition = "TEXT")
    private String visitNotes;

    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(name = "customer_notes", columnDefinition = "TEXT")
    private String customerNotes;

    // --- OUTCOME & FOLLOW-UP ---
    @Column(length = 100)
    private String outcome; // Interested, Need Follow-up, Measurement Required, Quotation Required, Quotation Sent, Project Confirmed, Project On Hold, Lost, Completed

    @Column(name = "next_action_notes", columnDefinition = "TEXT")
    private String nextActionNotes;

    @Column(name = "next_visit_required")
    private Boolean nextVisitRequired = false;

    @Column(name = "next_visit_date")
    private LocalDate nextVisitDate;

    @Column(name = "next_visit_time")
    private LocalDateTime nextVisitTime;

    @Column(name = "next_visit_purpose", length = 100)
    private String nextVisitPurpose;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "next_visit_assigned_to")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password"})
    private User nextVisitAssignedTo;

    @Column(name = "reminder_enabled")
    private Boolean reminderEnabled = true;

    @Column(name = "reminder_sent")
    private Boolean reminderSent = false;

    /** The visit this one was auto-created as a follow-up to, if any. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "follow_up_from_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private SiteVisit followUpFrom;

    // --- PROPERTY DETAILS ---
    @Column(name = "property_type", length = 100)
    private String propertyType;

    @Column(name = "total_floors")
    private Integer totalFloors;

    @Column(name = "area_sqft")
    private Double areaSqft;

    @Column(name = "construction_stage", length = 100)
    private String constructionStage;

    @Column(name = "site_condition", length = 200)
    private String siteCondition;

    @Column(length = 200)
    private String accessibility;

    @Column(name = "parking_availability")
    private Boolean parkingAvailability;

    @Column(name = "power_availability")
    private Boolean powerAvailability;

    @Column(name = "water_availability")
    private Boolean waterAvailability;

    // --- CUSTOMER REQUIREMENTS ---
    @Column(name = "preferred_style", length = 100)
    private String preferredStyle;

    @Column(name = "budget")
    private Double budget;

    @Column(name = "preferred_materials", length = 200)
    private String preferredMaterials;

    @Column(name = "preferred_colors", length = 200)
    private String preferredColors;

    @Column(name = "completion_timeline", length = 100)
    private String completionTimeline;

    @Column(name = "special_instructions", columnDefinition = "TEXT")
    private String specialInstructions;

    // --- SITE OBSERVATIONS ---
    @Column(name = "structural_issues", columnDefinition = "TEXT")
    private String structuralIssues;

    @Column(name = "electrical_issues", columnDefinition = "TEXT")
    private String electricalIssues;

    @Column(name = "plumbing_issues", columnDefinition = "TEXT")
    private String plumbingIssues;

    @Column(name = "painting_condition", columnDefinition = "TEXT")
    private String paintingCondition;

    @Column(name = "floor_condition", columnDefinition = "TEXT")
    private String floorCondition;

    @Column(name = "furniture_condition", columnDefinition = "TEXT")
    private String furnitureCondition;

    @Column(name = "safety_concerns", columnDefinition = "TEXT")
    private String safetyConcerns;

    @Column(columnDefinition = "TEXT")
    private String recommendations;

    // --- CUSTOMER SIGNATURE ---
    @Column(name = "signed_by_customer", length = 255)
    private String signedByCustomer;

    @Column(name = "signature_date")
    private LocalDateTime signatureDate;

    @Column(name = "signature_base64", columnDefinition = "LONGTEXT")
    private String signatureBase64;

    @Column(name = "signature_remarks", columnDefinition = "TEXT")
    private String signatureRemarks;
}
