package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "measurements")
public class Measurement extends BaseEntity {

    @Column(name = "measurement_number", unique = true, length = 50)
    private String measurementNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id")
    @JsonIgnoreProperties(value = {"hibernateLazyInitializer", "handler", "convertedToProject", "convertedToCustomer"}, allowSetters = true)
    private Lead lead;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    @JsonIgnoreProperties(value = {"hibernateLazyInitializer", "handler"}, allowSetters = true)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_visit_id")
    @JsonIgnoreProperties(value = {"hibernateLazyInitializer", "handler", "lead"}, allowSetters = true)
    private SiteVisit siteVisit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties(value = {"hibernateLazyInitializer", "handler", "lead", "measurement", "boq", "quotation"}, allowSetters = true)
    private Project project;

    @Column(name = "measurement_type", length = 50)
    private String measurementType; // Initial, Revision, Final, Verification, Site Recheck

    @Column(length = 50)
    private String status; // Draft, Assigned, Accepted, In Progress, Under Review, Approved, Revision Required, Completed, Cancelled

    @Column(length = 20)
    private String priority; // Low, Medium, High, Urgent

    @Column(name = "measured_by", length = 100)
    private String measuredBy;

    @Column(name = "verified_by", length = 100)
    private String verifiedBy;

    @Column(name = "measurement_date")
    private LocalDate measurementDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_engineer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User assignedEngineer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "designer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User designer;

    @Column(name = "revision_number")
    private Integer revisionNumber = 1;

    /** The measurement this one was revised from (null for originals). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_measurement_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "parentMeasurement", "lead", "customer",
            "siteVisit", "project", "assignedEngineer", "designer", "approvedBy", "reviewedBy"})
    private Measurement parentMeasurement;

    @Column(name = "is_latest_revision")
    private Boolean isLatestRevision = true;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    // Property Information
    @Column(name = "property_type", length = 100)
    private String propertyType;

    @Column(name = "location", length = 200)
    private String location;

    @Column(name = "site_address", columnDefinition = "TEXT")
    private String siteAddress;

    @Column(name = "construction_stage", length = 100)
    private String constructionStage;

    @Column(name = "total_floors")
    private Integer totalFloors;

    @Column(name = "total_area")
    private Double totalArea;

    @Column(name = "map_location", columnDefinition = "TEXT")
    private String mapLocation;

    // Aggregated auto-calculations (recomputed whenever rooms/items change)
    @Column(name = "total_floor_area")
    private Double totalFloorArea;

    @Column(name = "total_wall_area")
    private Double totalWallArea;

    @Column(name = "total_ceiling_area")
    private Double totalCeilingArea;

    @Column(name = "total_door_area")
    private Double totalDoorArea;

    @Column(name = "total_window_area")
    private Double totalWindowArea;

    @Column(name = "total_paintable_area")
    private Double totalPaintableArea;

    @Column(name = "total_false_ceiling_area")
    private Double totalFalseCeilingArea;

    @Column(name = "total_tile_area")
    private Double totalTileArea;

    @Column(name = "total_woodwork_area")
    private Double totalWoodworkArea;

    @Column(name = "room_count")
    private Integer roomCount;

    // Workflow audit trail
    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    // Customer Approval
    @Column(name = "customer_remarks", columnDefinition = "TEXT")
    private String customerRemarks;

    @Column(name = "approval_date")
    private LocalDateTime approvalDate;

    @Column(name = "digital_signature", columnDefinition = "LONGTEXT")
    private String digitalSignature;

    @Column(name = "engineer_signature", columnDefinition = "LONGTEXT")
    private String engineerSignature;
}
