package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "purchase_orders", indexes = {
    @Index(name = "idx_po_status", columnList = "status"),
    @Index(name = "idx_po_expected_delivery", columnList = "expected_delivery_date")
})
public class PurchaseOrder extends BaseEntity {

    @Column(name = "po_number", nullable = false, unique = true, length = 50)
    private String poNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(nullable = false)
    private LocalDate date = LocalDate.now();

    @Column(name = "expected_delivery_date")
    private LocalDate expectedDeliveryDate;

    @Column(nullable = false, length = 50)
    private String status = "DRAFT"; // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, SENT, CONFIRMED, PARTIAL, COMPLETED, CANCELLED

    /** Destination warehouse for the ordered material. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Warehouse warehouse;

    // --- Project purchase traceability (all optional) ---
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "quotation", "lead", "customer", "phases"})
    private Boq boq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project"})
    private ProjectPhase phase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "phase"})
    private ProjectRoom room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "assignedEmployee", "contractor", "phase", "room", "parentTask", "dependencies"})
    private Task task;

    /** The approved PR this PO was generated from, if any. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_request_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "items", "approvals", "product", "warehouse", "supplier",
            "project", "boq", "requestedBy", "approvedBy", "materialRequest", "convertedPurchaseOrder"})
    private PurchaseRequest purchaseRequest;

    // --- Commercial terms ---
    @Column(name = "delivery_address", columnDefinition = "TEXT")
    private String deliveryAddress;

    @Column(name = "payment_terms", length = 100)
    private String paymentTerms;

    @Column(precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "tax_percent", precision = 5, scale = 2)
    private BigDecimal taxPercent;

    @Column(name = "tax_amount", precision = 15, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "discount_amount", precision = 15, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "transportation_cost", precision = 15, scale = 2)
    private BigDecimal transportationCost;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
