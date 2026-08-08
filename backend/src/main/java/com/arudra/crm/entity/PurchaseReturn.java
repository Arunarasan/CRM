package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Return of received material back to the supplier (damaged / wrong / excess).
 * Confirming a return deducts the quantities from inventory via a SUPPLIER_RETURN transaction.
 */
@Getter
@Setter
@Entity
@Table(name = "purchase_returns", indexes = {
    @Index(name = "idx_pret_status", columnList = "status")
})
public class PurchaseReturn extends BaseEntity {

    @Column(name = "return_number", nullable = false, unique = true, length = 50)
    private String returnNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "supplier", "project", "warehouse", "boq", "phase", "room", "task", "purchaseRequest"})
    private PurchaseOrder purchaseOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grn_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "purchaseOrder", "warehouse", "receivedByUser", "photos"})
    private GoodsReceiptNote grn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Supplier supplier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Warehouse warehouse;

    @Column(name = "reason_type", nullable = false, length = 30)
    private String reasonType; // DAMAGED, WRONG_MATERIAL, EXCESS_QUANTITY

    @Column(nullable = false, length = 20)
    private String status = "DRAFT"; // DRAFT, CONFIRMED, CANCELLED

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @OneToMany(mappedBy = "purchaseReturn", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseReturnItem> items = new ArrayList<>();
}
