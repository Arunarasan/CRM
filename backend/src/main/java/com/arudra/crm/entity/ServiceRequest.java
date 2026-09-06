package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A service/support request raised by a customer from the portal. Phase 7 turns this into a CRM
 * {@link Task}; {@code task} links back once created so status flows to the customer.
 */
@Entity
@Table(name = "service_requests")
@Getter
@Setter
public class ServiceRequest extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    private Task task;

    @Column(name = "issue_type", length = 80)
    private String issueType;

    /** LOW | MEDIUM | HIGH | URGENT */
    @Column(nullable = false, length = 20)
    private String priority = "MEDIUM";

    @Column(nullable = false, length = 200)
    private String subject;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** OPEN | IN_PROGRESS | RESOLVED | CLOSED */
    @Column(nullable = false, length = 30)
    private String status = "OPEN";

    @Column(name = "preferred_date")
    private LocalDate preferredDate;

    // ---- Service work: warranty cover + free/paid billing (V77) ----

    /** PORTAL (raised by the customer) | STAFF (logged from the project's Service & Warranty tab). */
    @Column(nullable = false, length = 20)
    private String origin = "PORTAL";

    /** SERVICE | PRODUCT | NONE — which warranty the work is claimed under (context only). */
    @Column(name = "warranty_type", length = 20)
    private String warrantyType;

    /** FREE (in-warranty goodwill) | PAID — chosen manually by staff; null until decided. */
    @Column(name = "charge_type", length = 20)
    private String chargeType;

    /** Agreed charge for a PAID work; also the amount billed when an invoice is raised. */
    @Column(name = "charge_amount")
    private java.math.BigDecimal chargeAmount;

    /** The Billing invoice raised for a PAID work, once created. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id")
    private Invoice invoice;

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

    @OneToMany(mappedBy = "serviceRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ServiceRequestMedia> media = new ArrayList<>();
}
