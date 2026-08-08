package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** PPE checks, safety checklists, incidents and violations logged against a contractor on site. */
@Getter
@Setter
@Entity
@Table(name = "contractor_safety_records", indexes = {
    @Index(name = "idx_csr_contractor", columnList = "contractor_id"),
    @Index(name = "idx_csr_project", columnList = "project_id"),
    @Index(name = "idx_csr_type", columnList = "record_type")
})
public class ContractorSafetyRecord extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "phase", "room", "boq"})
    private ContractorWorkPackage workPackage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation",
            "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate = LocalDate.now();

    @Column(name = "record_type", nullable = false, length = 30)
    private String recordType; // PPE_CHECK, SAFETY_CHECKLIST, INCIDENT, VIOLATION

    @Column(length = 20)
    private String severity; // LOW, MEDIUM, HIGH, CRITICAL

    @Column(name = "ppe_compliant", nullable = false)
    private Boolean ppeCompliant = true;

    /** JSON array of {label, checked} — kept as text, matching the codebase's checklist convention. */
    @Column(columnDefinition = "TEXT")
    private String checklist;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "action_taken", columnDefinition = "TEXT")
    private String actionTaken;

    /** Charged back through the contractor's next bill as a penalty deduction. */
    @Column(name = "penalty_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal penaltyAmount = BigDecimal.ZERO;

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Column(nullable = false, length = 30)
    private String status = "OPEN"; // OPEN, CLOSED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User recordedBy;
}
