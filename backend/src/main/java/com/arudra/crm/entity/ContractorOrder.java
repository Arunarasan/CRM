package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A job given to a contractor on a project, with the amount agreed to pay him. Paid / balance /
 * payment status are derived from the {@link ContractorPayment}s linked to it — never stored here.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_orders", indexes = {
    @Index(name = "idx_cord_contractor", columnList = "contractor_id"),
    @Index(name = "idx_cord_project", columnList = "project_id")
})
public class ContractorOrder extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    /** Optional customer order (bundle) this job is for — plain id, like Bundle's own links. */
    @Column(name = "bundle_id")
    private Long bundleId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(name = "order_date")
    private LocalDate orderDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE, CANCELLED
}
