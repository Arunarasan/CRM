package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A store issue of materials to a contractor against a work package. Confirming the issue
 * moves stock out of inventory (CONSUMPTION); reconciling it returns unused stock
 * (PROJECT_RETURN) and prices waste/damage as a recovery from the contractor's bill.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_material_issues", indexes = {
    @Index(name = "idx_cmi_package", columnList = "work_package_id"),
    @Index(name = "idx_cmi_contractor", columnList = "contractor_id"),
    @Index(name = "idx_cmi_project", columnList = "project_id"),
    @Index(name = "idx_cmi_date", columnList = "issue_date")
})
public class ContractorMaterialIssue extends BaseEntity {

    @Column(name = "issue_number", unique = true, length = 50)
    private String issueNumber;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Warehouse warehouse;

    @Column(name = "issue_date", nullable = false)
    private LocalDate issueDate = LocalDate.now();

    @Column(nullable = false, length = 30)
    private String status = "DRAFT"; // DRAFT, ISSUED, PARTIALLY_RETURNED, RECONCILED, CANCELLED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issued_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User issuedBy;

    @Column(name = "received_by", length = 150)
    private String receivedBy;

    @Column(name = "total_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalValue = BigDecimal.ZERO;

    /** Value of waste/damage chargeable back to the contractor on the next bill. */
    @Column(name = "recoverable_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal recoverableValue = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
