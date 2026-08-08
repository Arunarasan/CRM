package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "inventory_transactions")
public class InventoryTransaction extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_warehouse_id")
    private Warehouse sourceWarehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_warehouse_id")
    private Warehouse destinationWarehouse;

    @Column(nullable = false, length = 50)
    private String type; // PURCHASE, CONSUMPTION, ADJUSTMENT, TRANSFER

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private LocalDateTime date = LocalDateTime.now();

    @Column(length = 100)
    private String reference;

    @Column(name = "reference_type", length = 50)
    private String referenceType; // e.g. QUOTATION, PROJECT

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;
}
