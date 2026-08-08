package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Supplier invoice logged against a purchase order. */
@Getter
@Setter
@Entity
@Table(name = "purchase_bills", indexes = {
    @Index(name = "idx_pb_status", columnList = "status"),
    @Index(name = "idx_pb_due_date", columnList = "due_date")
})
public class PurchaseBill extends BaseEntity {

    @Column(name = "bill_number", nullable = false, unique = true, length = 50)
    private String billNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "supplier", "project", "warehouse", "boq", "phase", "room", "task", "purchaseRequest"})
    private PurchaseOrder purchaseOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Supplier supplier;

    @Column(nullable = false)
    private LocalDate date = LocalDate.now();

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "tax_amount", precision = 15, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "total_amount", precision = 15, scale = 2, nullable = false)
    private BigDecimal totalAmount;

    @Column(nullable = false, length = 50)
    private String status = "UNPAID"; // UNPAID, PARTIAL, PAID

    @Column(columnDefinition = "TEXT")
    private String notes;
}
