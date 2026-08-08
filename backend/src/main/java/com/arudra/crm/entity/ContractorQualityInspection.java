package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Quality gate on contractor work. A FAIL/REWORK result pushes the package back to REWORK;
 * only an APPROVED inspection lets the package close and a final bill be raised.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_quality_inspections", indexes = {
    @Index(name = "idx_cqi_package", columnList = "work_package_id"),
    @Index(name = "idx_cqi_project", columnList = "project_id"),
    @Index(name = "idx_cqi_result", columnList = "result")
})
public class ContractorQualityInspection extends BaseEntity {

    @Column(name = "inspection_number", unique = true, length = 50)
    private String inspectionNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "phase", "room", "boq"})
    private ContractorWorkPackage workPackage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation",
            "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @Column(name = "inspection_date", nullable = false)
    private LocalDate inspectionDate = LocalDate.now();

    /** IN_PROGRESS_CHECK, PRE_HANDOVER, FINAL, SNAG_VERIFICATION. */
    @Column(name = "inspection_type", length = 50)
    private String inspectionType;

    @Column(nullable = false, length = 30)
    private String result = "PENDING"; // PENDING, PASS, FAIL, REWORK, APPROVED

    /** 0-100 quality score, feeds the contractor's quality rating. */
    private Integer score;

    /** JSON array of {label, checked, remarks} — kept as text, matching the codebase's checklist convention. */
    @Column(columnDefinition = "TEXT")
    private String checklist;

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(columnDefinition = "TEXT")
    private String defects;

    @Column(name = "corrective_action", columnDefinition = "TEXT")
    private String correctiveAction;

    @Column(name = "rework_due_date")
    private LocalDate reworkDueDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspected_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User inspectedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(columnDefinition = "TEXT")
    private String comments;
}
