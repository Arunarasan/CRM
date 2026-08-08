package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Payment made to a supplier. Regular (PARTIAL/FULL) payments are recorded against a bill;
 * ADVANCE payments may be recorded against a purchase order before any bill exists.
 */
@Getter
@Setter
@Entity
@Table(name = "purchase_payments")
public class PurchasePayment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_bill_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "purchaseOrder", "supplier"})
    private PurchaseBill purchaseBill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "supplier", "project", "warehouse", "boq", "phase", "room", "task", "purchaseRequest"})
    private PurchaseOrder purchaseOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Supplier supplier;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "payment_type", nullable = false, length = 20)
    private String paymentType = "PARTIAL"; // ADVANCE, PARTIAL, FULL

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate = LocalDate.now();

    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
